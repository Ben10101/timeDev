import importlib.util
import sys
import types
import unittest
from pathlib import Path


# Load the QA units without importing the repository-wide agents package, whose
# production bootstrap reads local provider credentials.
ROOT = Path(__file__).resolve().parents[1]
agents_package = types.ModuleType('agents')
agents_package.__path__ = [str(ROOT / 'agents')]
developer_package = types.ModuleType('agents.developer')
developer_package.__path__ = [str(ROOT / 'agents' / 'developer')]
llm_service = types.ModuleType('agents.developer.llm_service')
llm_service.generate_text_from_llm = lambda *_args, **_kwargs: ''
llm_service.is_error_text_response = lambda _value: False
sys.modules.update({
    'agents': agents_package,
    'agents.developer': developer_package,
    'agents.developer.llm_service': llm_service,
})

validation_spec = importlib.util.spec_from_file_location('agents.developer.response_validation', ROOT / 'agents' / 'developer' / 'response_validation.py')
validation_module = importlib.util.module_from_spec(validation_spec)
sys.modules[validation_spec.name] = validation_module
validation_spec.loader.exec_module(validation_module)

qa_spec = importlib.util.spec_from_file_location('agents.qa_engineer.agent', ROOT / 'agents' / 'qa_engineer' / 'agent.py')
qa_module = importlib.util.module_from_spec(qa_spec)
sys.modules[qa_spec.name] = qa_module
qa_spec.loader.exec_module(qa_module)

validate_qa_output = validation_module.validate_qa_output
QAEngineer = qa_module.QAEngineer


SPEC = {
    "acceptanceCriteria": [
        {"id": "CA-01", "text": "Dado um administrador, quando informar dados válidos, então a sala é cadastrada."},
        {"id": "CA-02", "text": "Dado um campo obrigatório ausente, quando tentar salvar, então o sistema bloqueia o cadastro."},
    ],
    "assumptions": [],
}


class QaValidationCasesTest(unittest.TestCase):
    def test_fallback_covers_each_persisted_criterion_without_execution_claim(self):
        criteria = QAEngineer._criteria(SPEC)
        result = QAEngineer._fallback(criteria, [])
        valid, reason = validate_qa_output(result, expected_criteria_ids=[item["id"] for item in criteria])
        self.assertTrue(valid, reason)
        self.assertIn("Status: não executado", result)
        self.assertIn("CA-01 -> CT-01", result)
        self.assertIn("CA-02 -> CT-02", result)

    def test_validator_rejects_unknown_or_uncovered_criterion(self):
        result = QAEngineer._fallback(QAEngineer._criteria(SPEC), [])
        result = result.replace("Critério relacionado: CA-02", "Critério relacionado: CA-99")
        valid, reason = validate_qa_output(result, expected_criteria_ids=["CA-01", "CA-02"])
        self.assertFalse(valid)
        self.assertIn("inexistentes", reason)

    def test_fallback_keeps_real_lacunas_as_review_not_product_behavior(self):
        result = QAEngineer._fallback(QAEngineer._criteria(SPEC), ["Definir política de remoção de salas com reservas futuras."])
        self.assertIn("Status: precisa de revisão", result)
        self.assertIn("Definir política", result)
        self.assertNotIn("falha do backend", result.lower())


if __name__ == "__main__":
    unittest.main()
