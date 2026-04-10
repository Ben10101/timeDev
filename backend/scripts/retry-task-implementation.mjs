import { runTaskImplementation } from '../src/services/implementationService.js';
import dotenv from 'dotenv';
dotenv.config();

const taskUuid = '8db29115-e0b5-487a-82dd-8f99d957fb1e';
const userUuid = '7abeaba1-deba-4323-abd5-0b62eac53e0e';

async function retry() {
  console.log(`Iniciando retentativa de implementação para a task ${taskUuid}...`);
  try {
    const result = await runTaskImplementation(taskUuid, userUuid, { forceRefresh: true });
    console.log('Implementação concluída com sucesso!');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Erro na implementação:', error);
  } finally {
    process.exit();
  }
}

retry();
