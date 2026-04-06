import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { recoverBlockingAgentRunsForStart } from './agentRunRecoveryService.js';
import { estimateTokenCount } from '../utils/aiRunMetrics.js';
import { DEFAULT_AI_SETTINGS, getAiSettingsForUser } from './aiSettingsService.js';
import { inferProjectTemplateKey, resolveProjectTemplate } from '../templates/projects/index.js';

const taskListInclude = {
  assigneeUser: { select: { uuid: true, name: true, email: true } },
  reporterUser: { select: { uuid: true, name: true, email: true } },
  creator: { select: { uuid: true, name: true, email: true } },
  artifacts: {
    where: { isCurrent: true, artifactScope: 'refinement' },
    orderBy: { createdAt: 'desc' },
  },
  statusHistory: {
    orderBy: { changedAt: 'desc' },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      changedAt: true,
    },
  },
  _count: { select: { artifacts: true, comments: true, checklistItems: true } },
};

const taskDetailInclude = {
  ...taskListInclude,
  project: {
    select: {
      uuid: true,
      name: true,
      slug: true,
      status: true,
      members: {
        include: {
          user: {
            select: { uuid: true, name: true, email: true },
          },
        },
      },
    },
  },
  comments: {
    orderBy: { createdAt: 'desc' },
    include: {
      authorUser: { select: { uuid: true, name: true, email: true } },
    },
  },
  artifacts: {
    where: { artifactScope: 'refinement' },
    orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
  },
  statusHistory: {
    orderBy: { changedAt: 'desc' },
    include: {
      changedByUser: { select: { uuid: true, name: true, email: true } },
    },
  },
  checklistItems: {
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  },
  agentRuns: {
    orderBy: { createdAt: 'desc' },
  },
};

function getDurationSeconds(startAt, endAt = new Date()) {
  if (!startAt) return 0;
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : new Date();
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

function buildTaskTiming(task) {
  const now = new Date();
  const leadTimeSeconds = getDurationSeconds(task.createdAt, task.completedAt || now);

  const byAgent = (task.agentRuns || []).reduce((acc, run) => {
    const durationSeconds = run.startedAt ? getDurationSeconds(run.startedAt, run.finishedAt || now) : 0;
    const current = acc[run.agentName] || {
      agentName: run.agentName,
      runs: 0,
      totalDurationSeconds: 0,
      lastStatus: run.status,
      lastFinishedAt: run.finishedAt || null,
    };

    current.runs += 1;
    current.totalDurationSeconds += durationSeconds;
    current.lastStatus = run.status;
    current.lastFinishedAt = run.finishedAt || current.lastFinishedAt;
    acc[run.agentName] = current;
    return acc;
  }, {});

  const totalAgentProcessingSeconds = Object.values(byAgent).reduce(
    (total, agent) => total + (agent.totalDurationSeconds || 0),
    0
  );
  const cycleTimeSeconds =
    totalAgentProcessingSeconds > 0
      ? totalAgentProcessingSeconds
      : task.startedAt
        ? getDurationSeconds(task.startedAt, task.completedAt || now)
        : 0;

  return {
    leadTimeSeconds,
    cycleTimeSeconds,
    requirementsTimeSeconds: byAgent.requirements_analyst?.totalDurationSeconds || 0,
    qaTimeSeconds: byAgent.qa_engineer?.totalDurationSeconds || 0,
    byAgent: Object.values(byAgent),
  };
}

function getAgentDisplayName(agentName, agentAliases = DEFAULT_AI_SETTINGS.agentAliases) {
  if (!agentName) return null;
  return agentAliases?.[agentName] || agentName;
}

function enrichTask(task, agentAliases = DEFAULT_AI_SETTINGS.agentAliases) {
  if (!task) return task;
  const latestAgentRun = (task.agentRuns || [])[0] || null;
  const processingError =
    latestAgentRun?.status === 'failed'
      ? {
          agentName: latestAgentRun.agentName,
          agentLabel: getAgentDisplayName(latestAgentRun.agentName, agentAliases),
          message: latestAgentRun.errorMessage || 'Falha ao processar a task.',
          happenedAt: latestAgentRun.finishedAt || latestAgentRun.createdAt || null,
        }
      : null;

  return {
    ...task,
    assigneeAgentLabel: getAgentDisplayName(task.assigneeAgentName, agentAliases),
    timing: {
      ...buildTaskTiming(task),
      byAgent: (buildTaskTiming(task).byAgent || []).map((item) => ({
        ...item,
        agentLabel: getAgentDisplayName(item.agentName, agentAliases),
      })),
    },
    latestAgentRun: latestAgentRun
      ? {
          ...latestAgentRun,
          agentLabel: getAgentDisplayName(latestAgentRun.agentName, agentAliases),
        }
      : null,
    agentRuns: (task.agentRuns || []).map((run) => ({
      ...run,
      agentLabel: getAgentDisplayName(run.agentName, agentAliases),
    })),
    processingError,
  };
}

const workflowOrder = ['backlog', 'todo', 'in_progress', 'in_review', 'qa', 'done'];
const projectRoleOrder = ['viewer', 'editor', 'manager', 'owner'];

function hasCurrentArtifact(task, artifactType) {
  return (task.artifacts || []).some((artifact) => artifact.artifactType === artifactType && artifact.isCurrent);
}

function validateTaskStatusTransition(existingTask, nextStatus) {
  if (!nextStatus || nextStatus === existingTask.status) return;

  if (nextStatus === 'blocked' || nextStatus === 'archived') return;

  const currentIndex = workflowOrder.indexOf(existingTask.status);
  const nextIndex = workflowOrder.indexOf(nextStatus);

  if (currentIndex !== -1 && nextIndex !== -1 && nextIndex < currentIndex) {
    throw new Error('NÃ£o Ã© permitido voltar a tarefa para uma etapa anterior.');
  }

  if (nextStatus === 'qa' && !hasCurrentArtifact(existingTask, 'requirements')) {
    throw new Error('A tarefa sÃ³ pode seguir para QA depois que os requisitos estiverem processados.');
  }
}

function buildProjectAccessFilter(userUuid) {
  if (!userUuid) return {};

  return {
    OR: [
      { creator: { is: { uuid: userUuid } } },
      {
        workspace: {
          is: {
            ownerUser: {
              is: {
                uuid: userUuid,
              },
            },
          },
        },
      },
      {
        members: {
          some: {
            user: {
              is: {
                uuid: userUuid,
              },
            },
          },
        },
      },
    ],
  };
}

function getProjectRoleRank(role) {
  const index = projectRoleOrder.indexOf(role || 'viewer');
  return index === -1 ? 0 : index;
}

function buildProjectPermissions(currentUserRole = 'viewer') {
  const roleRank = getProjectRoleRank(currentUserRole);
  return {
    canViewProject: roleRank >= getProjectRoleRank('viewer'),
    canEditProject: roleRank >= getProjectRoleRank('manager'),
    canManageMembers: roleRank >= getProjectRoleRank('manager'),
    canCreateTask: roleRank >= getProjectRoleRank('editor'),
    canEditTask: roleRank >= getProjectRoleRank('editor'),
    canRunAgents: roleRank >= getProjectRoleRank('editor'),
    canApproveArchitecture: roleRank >= getProjectRoleRank('manager'),
  };
}

function resolveCurrentUserProjectRole(project, userUuid) {
  if (!userUuid || !project) return 'viewer';
  if (project.creator?.uuid === userUuid) return 'owner';
  if (project.workspace?.ownerUser?.uuid === userUuid) return 'owner';

  const membership = (project.members || []).find((member) => member.user?.uuid === userUuid);
  return membership?.projectRole || 'viewer';
}

function enrichProjectAccess(project, userUuid = null) {
  if (!project) return project;

  const currentUserRole = resolveCurrentUserProjectRole(project, userUuid);
  const resolvedProjectTemplate = resolveProjectTemplate(
    project.templateKey || project.intakeConfig?.projectTemplateKey || null,
    {
      projectName: project.name,
      summary: project.description || project.vision || '',
      label: project.name,
    }
  );
  return {
    ...project,
    currentUserRole,
    permissions: buildProjectPermissions(currentUserRole),
    resolvedProjectTemplate,
  };
}

export async function assertProjectPermission(projectUuid, userUuid, minimumRole = 'viewer') {
  const project = await prisma.project.findFirst({
    where: {
      uuid: projectUuid,
      ...buildProjectAccessFilter(userUuid),
    },
    select: {
      id: true,
      uuid: true,
      createdBy: true,
      creator: {
        select: { uuid: true },
      },
      workspace: {
        select: {
          uuid: true,
          ownerUser: {
            select: { uuid: true },
          },
        },
      },
      members: {
        include: {
          user: {
            select: { uuid: true },
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error('Projeto nÃ£o encontrado ou sem permissÃ£o de acesso.');
  }

  const currentUserRole = resolveCurrentUserProjectRole(project, userUuid);
  if (getProjectRoleRank(currentUserRole) < getProjectRoleRank(minimumRole)) {
    throw new Error('VocÃª nÃ£o tem permissÃ£o para executar esta aÃ§Ã£o neste projeto.');
  }

  return enrichProjectAccess(project, userUuid);
}

export async function getDefaultWorkspaceForUserUuid(userUuid) {
  if (!userUuid) return null;

  const user = await prisma.user.findUnique({
    where: { uuid: userUuid },
    select: { id: true },
  });

  if (!user) return null;

  const ownedWorkspace = await prisma.workspace.findFirst({
    where: { ownerUserId: user.id },
    select: { id: true, uuid: true, name: true, slug: true },
    orderBy: { createdAt: 'asc' },
  });

  if (ownedWorkspace) return ownedWorkspace;

  const membership = await prisma.projectMember.findFirst({
    where: { userId: user.id },
    include: {
      project: {
        include: {
          workspace: {
            select: { id: true, uuid: true, name: true, slug: true },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  return membership?.project?.workspace || null;
}

export async function assertWorkspaceAccess(workspaceUuid, userUuid) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      uuid: workspaceUuid,
      OR: [
        {
          ownerUser: {
            is: {
              uuid: userUuid,
            },
          },
        },
        {
          projects: {
            some: {
              members: {
                some: {
                  user: {
                    is: {
                      uuid: userUuid,
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
    select: { id: true, uuid: true, name: true, slug: true },
  });

  if (!workspace) {
    throw new Error('Workspace nÃ£o encontrado ou sem permissÃ£o de acesso.');
  }

  return workspace;
}

export async function getWorkspaceTeamSummary(userUuid, workspaceUuid = null) {
  const workspace =
    workspaceUuid
      ? await assertWorkspaceAccess(workspaceUuid, userUuid)
      : await getDefaultWorkspaceForUserUuid(userUuid);

  if (!workspace?.uuid) {
    throw new Error('Workspace não encontrado ou sem permissão de acesso.');
  }

  const workspaceRecord = await prisma.workspace.findUnique({
    where: { uuid: workspace.uuid },
    select: {
      uuid: true,
      name: true,
      slug: true,
      description: true,
      ownerUser: {
        select: { uuid: true, name: true, email: true },
      },
      projects: {
        orderBy: { createdAt: 'asc' },
        select: {
          uuid: true,
          name: true,
          slug: true,
          status: true,
          creator: {
            select: { uuid: true, name: true, email: true },
          },
          workspace: {
            select: {
              ownerUser: {
                select: { uuid: true },
              },
            },
          },
          members: {
            include: {
              user: {
                select: { uuid: true, name: true, email: true },
              },
            },
          },
        },
      },
    },
  });

  if (!workspaceRecord) {
    throw new Error('Workspace não encontrado.');
  }

  const peopleMap = new Map();

  for (const project of workspaceRecord.projects) {
    const currentUserRole = resolveCurrentUserProjectRole(project, userUuid);
    const permissions = buildProjectPermissions(currentUserRole);

    for (const member of project.members || []) {
      const memberUser = member.user;
      if (!memberUser?.uuid) continue;

      const current = peopleMap.get(memberUser.uuid) || {
        user: memberUser,
        workspaceOwner: workspaceRecord.ownerUser?.uuid === memberUser.uuid,
        memberships: [],
      };

      current.memberships.push({
        projectUuid: project.uuid,
        projectName: project.name,
        projectStatus: project.status,
        projectRole: member.projectRole,
        joinedAt: member.joinedAt,
        currentUserRole,
        permissions,
      });

      peopleMap.set(memberUser.uuid, current);
    }
  }

  if (workspaceRecord.ownerUser?.uuid) {
    const existingOwner = peopleMap.get(workspaceRecord.ownerUser.uuid);
    if (existingOwner) {
      existingOwner.workspaceOwner = true;
      peopleMap.set(workspaceRecord.ownerUser.uuid, existingOwner);
    } else {
      peopleMap.set(workspaceRecord.ownerUser.uuid, {
        user: workspaceRecord.ownerUser,
        workspaceOwner: true,
        memberships: [],
      });
    }
  }

  const members = Array.from(peopleMap.values())
    .map((member) => ({
      ...member,
      memberships: [...member.memberships].sort((left, right) =>
        String(left.projectName || '').localeCompare(String(right.projectName || ''), 'pt-BR')
      ),
    }))
    .sort((left, right) => {
      if (left.workspaceOwner !== right.workspaceOwner) {
        return left.workspaceOwner ? -1 : 1;
      }
      return String(left.user?.name || left.user?.email || '').localeCompare(
        String(right.user?.name || right.user?.email || ''),
        'pt-BR'
      );
    });

  return {
    workspace: {
      uuid: workspaceRecord.uuid,
      name: workspaceRecord.name,
      slug: workspaceRecord.slug,
      description: workspaceRecord.description,
      ownerUser: workspaceRecord.ownerUser,
    },
    canManageWorkspace: workspaceRecord.ownerUser?.uuid === userUuid,
    projects: workspaceRecord.projects.map((project) => {
      const currentUserRole = resolveCurrentUserProjectRole(project, userUuid);
      return {
        uuid: project.uuid,
        name: project.name,
        slug: project.slug,
        status: project.status,
        currentUserRole,
        permissions: buildProjectPermissions(currentUserRole),
        memberCount: project.members.length,
      };
    }),
    members,
    summary: {
      totalProjects: workspaceRecord.projects.length,
      totalPeople: members.length,
      managers: members.filter((member) =>
        member.memberships.some((membership) => ['owner', 'manager'].includes(membership.projectRole))
      ).length,
      contributors: members.filter((member) =>
        member.memberships.some((membership) => membership.projectRole === 'editor')
      ).length,
      viewers: members.filter((member) =>
        member.memberships.every((membership) => membership.projectRole === 'viewer')
      ).length,
    },
  };
}

export async function assertProjectAccess(projectUuid, userUuid) {
  const project = await prisma.project.findFirst({
    where: {
      uuid: projectUuid,
      ...buildProjectAccessFilter(userUuid),
    },
    select: { id: true, uuid: true, workspaceId: true, createdBy: true },
  });

  if (!project) {
    throw new Error('Projeto nÃ£o encontrado ou sem permissÃ£o de acesso.');
  }

  return project;
}

export async function assertTaskAccess(taskUuid, userUuid) {
  const task = await prisma.task.findFirst({
    where: {
      uuid: taskUuid,
      project: {
        is: buildProjectAccessFilter(userUuid),
      },
    },
    select: { id: true, uuid: true, projectId: true },
  });

  if (!task) {
    throw new Error('Tarefa nÃ£o encontrada ou sem permissÃ£o de acesso.');
  }

  return task;
}

export async function listProjects(userUuid = null) {
  const projects = await prisma.project.findMany({
    where: buildProjectAccessFilter(userUuid),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      uuid: true,
      name: true,
      slug: true,
      description: true,
      vision: true,
      startMode: true,
      templateKey: true,
      intakeConfig: true,
      workspace: {
        select: {
          uuid: true,
          name: true,
          slug: true,
          ownerUser: {
            select: { uuid: true },
          },
        },
      },
      creator: {
        select: { uuid: true, name: true, email: true },
      },
      ...(userUuid
        ? {
            members: {
              where: {
                user: {
                  is: {
                    uuid: userUuid,
                  },
                },
              },
              include: {
                user: {
                  select: { uuid: true },
                },
              },
            },
          }
        : {}),
      _count: {
        select: { tasks: true, agentRuns: true },
      },
    },
  });

  return projects.map((project) => enrichProjectAccess(project, userUuid));
}

export async function bootstrapWorkspaceAndUser({ userName, email, workspaceName, passwordHash = null, failIfUserExists = false }) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedWorkspaceName = workspaceName?.trim() || 'Meu Workspace';
  const workspaceSlug =
    normalizedWorkspaceName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 150) || `workspace-${randomUUID().slice(0, 8)}`;

  return prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await tx.user.create({
        data: {
          uuid: randomUUID(),
          name: userName.trim(),
          email: normalizedEmail,
          passwordHash,
          role: 'owner',
          status: 'active',
        },
      });
    } else {
      if (failIfUserExists) {
        throw new Error('JÃ¡ existe um usuÃ¡rio com este e-mail.');
      }

      if (!user.passwordHash && passwordHash) {
        user = await tx.user.update({
          where: { id: user.id },
          data: { passwordHash },
        });
      }
    }

    let workspace = await tx.workspace.findFirst({
      where: {
        ownerUserId: user.id,
        name: normalizedWorkspaceName,
      },
    });

    if (!workspace) {
      let uniqueSlug = workspaceSlug;
      let suffix = 1;

      while (
        await tx.workspace.findFirst({
          where: { slug: uniqueSlug },
          select: { id: true },
        })
      ) {
        suffix += 1;
        uniqueSlug = `${workspaceSlug}-${suffix}`;
      }

      workspace = await tx.workspace.create({
        data: {
          uuid: randomUUID(),
          name: normalizedWorkspaceName,
          slug: uniqueSlug,
          ownerUserId: user.id,
        },
      });
    }

    return { user, workspace };
  });
}

export async function getProjectByUuid(projectUuid, userUuid = null) {
  const project = await prisma.project.findFirst({
    where: {
      uuid: projectUuid,
      ...buildProjectAccessFilter(userUuid),
    },
    select: {
      id: true,
      uuid: true,
      name: true,
      slug: true,
      description: true,
      vision: true,
      startMode: true,
      templateKey: true,
      intakeConfig: true,
      workspace: {
        select: {
          uuid: true,
          name: true,
          slug: true,
          ownerUser: {
            select: { uuid: true },
          },
        },
      },
      creator: {
        select: { uuid: true, name: true, email: true },
      },
      members: {
        include: {
          user: {
            select: { uuid: true, name: true, email: true },
          },
        },
      },
      tasks: {
        where: {
          taskType: {
            not: 'agent_job',
          },
        },
        orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
        include: {
          _count: {
            select: { artifacts: true, comments: true, checklistItems: true },
          },
        },
      },
    },
  });

  return enrichProjectAccess(project, userUuid);
}

export async function updateProjectBrief(projectUuid, input = {}) {
  const existingProject = await prisma.project.findUnique({
    where: { uuid: projectUuid },
    select: { id: true, name: true, description: true, vision: true, templateKey: true, intakeConfig: true },
  });

  if (!existingProject) {
    throw new Error('Projeto nÃ£o encontrado.');
  }

  const mergedIntakeConfig =
    input.intakeConfig !== undefined
      ? {
          ...(existingProject.intakeConfig || {}),
          ...input.intakeConfig,
        }
      : existingProject.intakeConfig || {};

  const resolvedTemplateKey =
    input.templateKey !== undefined
      ? input.templateKey?.trim() || null
      : existingProject.templateKey ||
        mergedIntakeConfig.projectTemplateKey ||
        inferProjectTemplateKey({
          projectName: existingProject.name,
          description: input.description !== undefined ? input.description : existingProject.description,
          vision: input.vision !== undefined ? input.vision : existingProject.vision,
          idea: mergedIntakeConfig.idea,
          summary: mergedIntakeConfig.objective,
        });

  return prisma.project.update({
    where: { uuid: projectUuid },
    data: {
      description: input.description !== undefined ? input.description?.trim() || null : undefined,
      vision: input.vision !== undefined ? input.vision?.trim() || null : undefined,
      templateKey: resolvedTemplateKey,
      intakeConfig:
        input.intakeConfig !== undefined
          ? {
              ...mergedIntakeConfig,
              projectTemplateKey: resolvedTemplateKey || mergedIntakeConfig.projectTemplateKey || null,
            }
          : undefined,
    },
  });
}

export async function addProjectMember(projectUuid, { email, projectRole = 'editor' }, actorUserUuid) {
  const access = await assertProjectPermission(projectUuid, actorUserUuid, 'manager');
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error('Informe o e-mail do membro que deve entrar no projeto.');
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, uuid: true, name: true, email: true },
  });

  if (!user) {
    throw new Error('Nenhum usuÃ¡rio encontrado com este e-mail.');
  }

  const existingMember = await prisma.projectMember.findFirst({
    where: {
      projectId: access.id,
      userId: user.id,
    },
    select: { id: true },
  });

  if (existingMember) {
    throw new Error('Este usuÃ¡rio jÃ¡ faz parte do projeto.');
  }

  await prisma.projectMember.create({
    data: {
      projectId: access.id,
      userId: user.id,
      projectRole,
    },
  });

  return getProjectByUuid(projectUuid, actorUserUuid);
}

export async function updateProjectMemberRole(projectUuid, memberUuid, { projectRole }, actorUserUuid) {
  const access = await assertProjectPermission(projectUuid, actorUserUuid, 'manager');

  const member = await prisma.projectMember.findFirst({
    where: {
      project: {
        is: {
          id: access.id,
        },
      },
      user: {
        is: {
          uuid: memberUuid,
        },
      },
    },
    include: {
      user: {
        select: { uuid: true },
      },
    },
  });

  if (!member) {
    throw new Error('Membro nÃ£o encontrado neste projeto.');
  }

  const actorRole = access.currentUserRole;
  if (member.projectRole === 'owner' && actorRole !== 'owner') {
    throw new Error('Somente o owner do projeto pode alterar outro owner.');
  }

  await prisma.projectMember.update({
    where: { id: member.id },
    data: { projectRole },
  });

  return getProjectByUuid(projectUuid, actorUserUuid);
}

export async function removeProjectMember(projectUuid, memberUuid, actorUserUuid) {
  const access = await assertProjectPermission(projectUuid, actorUserUuid, 'manager');

  const member = await prisma.projectMember.findFirst({
    where: {
      project: {
        is: {
          id: access.id,
        },
      },
      user: {
        is: {
          uuid: memberUuid,
        },
      },
    },
    include: {
      user: {
        select: { uuid: true },
      },
    },
  });

  if (!member) {
    throw new Error('Membro nÃ£o encontrado neste projeto.');
  }

  const ownerCount = await prisma.projectMember.count({
    where: {
      projectId: access.id,
      projectRole: 'owner',
    },
  });

  if (member.projectRole === 'owner' && ownerCount <= 1) {
    throw new Error('O projeto precisa manter pelo menos um owner.');
  }

  if (member.projectRole === 'owner' && access.currentUserRole !== 'owner') {
    throw new Error('Somente o owner do projeto pode remover outro owner.');
  }

  await prisma.projectMember.delete({
    where: { id: member.id },
  });

  return getProjectByUuid(projectUuid, actorUserUuid);
}

export async function createProject({
  workspaceUuid,
  createdByUuid,
  name,
  description,
  vision,
  startMode,
  templateKey,
  intakeConfig,
  boardConfig,
  agentsConfig,
  automationConfig,
  status,
  forcedUuid,
}) {
  const [workspace, user] = await Promise.all([
    prisma.workspace.findUnique({ where: { uuid: workspaceUuid } }),
    prisma.user.findUnique({ where: { uuid: createdByUuid } }),
  ]);

  if (!workspace) {
    throw new Error('Workspace nÃ£o encontrado.');
  }

  if (!user) {
    throw new Error('UsuÃ¡rio criador nÃ£o encontrado.');
  }

  const slugBase =
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 150) || `projeto-${randomUUID().slice(0, 8)}`;

  let slug = slugBase;
  let suffix = 1;

  while (
    await prisma.project.findFirst({
      where: { workspaceId: workspace.id, slug },
      select: { id: true },
    })
  ) {
    suffix += 1;
    slug = `${slugBase}-${suffix}`;
  }

  const resolvedTemplateKey =
    templateKey?.trim() ||
    inferProjectTemplateKey({
      projectName: name,
      description,
      vision,
      idea: intakeConfig?.idea,
      summary: intakeConfig?.objective,
    });

  const normalizedIntakeConfig =
    intakeConfig !== undefined
      ? {
          ...(intakeConfig || {}),
          projectTemplateKey: resolvedTemplateKey || intakeConfig?.projectTemplateKey || null,
        }
      : undefined;

  return prisma.project.create({
    data: {
      uuid: forcedUuid || randomUUID(),
      workspaceId: workspace.id,
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      vision: vision?.trim() || null,
      startMode: startMode?.trim() || null,
      templateKey: resolvedTemplateKey || null,
      intakeConfig: normalizedIntakeConfig,
      boardConfig: boardConfig ?? undefined,
      agentsConfig: agentsConfig ?? undefined,
      automationConfig: automationConfig ?? undefined,
      status: status || 'draft',
      createdBy: user.id,
      members: {
        create: {
          userId: user.id,
          projectRole: 'owner',
        },
      },
    },
    include: {
      workspace: {
        select: { uuid: true, name: true, slug: true },
      },
      creator: {
        select: { uuid: true, name: true, email: true },
      },
    },
  });
}

export async function listProjectTasks(projectUuid, { status, parentTaskUuid } = {}, userUuid = null) {
  const project = await prisma.project.findFirst({
    where: {
      uuid: projectUuid,
      ...buildProjectAccessFilter(userUuid),
    },
    select: { id: true },
  });

  if (!project) {
    throw new Error('Projeto nÃ£o encontrado.');
  }

  let parentTaskId;
  if (parentTaskUuid) {
    const parentTask = await prisma.task.findUnique({
      where: { uuid: parentTaskUuid },
      select: { id: true, projectId: true },
    });

    if (!parentTask || parentTask.projectId !== project.id) {
      throw new Error('Tarefa pai nÃ£o encontrada neste projeto.');
    }
    parentTaskId = parentTask.id;
  }

  const tasks = await prisma.task.findMany({
    where: {
      projectId: project.id,
      taskType: {
        not: 'agent_job',
      },
      ...(status ? { status } : {}),
      ...(parentTaskUuid ? { parentTaskId } : {}),
    },
    orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
    include: {
      ...taskListInclude,
      agentRuns: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const agentAliases = userUuid ? (await getAiSettingsForUser(userUuid)).agentAliases : DEFAULT_AI_SETTINGS.agentAliases;
  return tasks.map((task) => enrichTask(task, agentAliases));
}

export async function listAllTasks({ status } = {}, userUuid = null) {
  const tasks = await prisma.task.findMany({
    where: {
      taskType: {
        not: 'agent_job',
      },
      ...(status ? { status } : {}),
      project: {
        is: buildProjectAccessFilter(userUuid),
      },
    },
    orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
    include: {
      ...taskListInclude,
      project: {
        select: { uuid: true, name: true, slug: true },
      },
      agentRuns: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const agentAliases = userUuid ? (await getAiSettingsForUser(userUuid)).agentAliases : DEFAULT_AI_SETTINGS.agentAliases;
  return tasks.map((task) => enrichTask(task, agentAliases));
}

export async function getTaskByUuid(taskUuid, userUuid = null) {
  const task = await prisma.task.findFirst({
    where: {
      uuid: taskUuid,
      ...(userUuid
        ? {
            project: {
              is: buildProjectAccessFilter(userUuid),
            },
          }
        : {}),
    },
    include: taskDetailInclude,
  });

  const agentAliases = userUuid ? (await getAiSettingsForUser(userUuid)).agentAliases : DEFAULT_AI_SETTINGS.agentAliases;
  const enrichedTask = enrichTask(task, agentAliases);

  if (enrichedTask?.project) {
    enrichedTask.project = enrichProjectAccess(enrichedTask.project, userUuid);
  }

  return enrichedTask;
}

export async function createTask(projectUuid, input) {
  const project = await prisma.project.findUnique({
    where: { uuid: projectUuid },
    select: { id: true },
  });

  if (!project) {
    throw new Error('Projeto nÃ£o encontrado.');
  }

  const [creator, reporter, assigneeUser, parentTask] = await Promise.all([
    prisma.user.findUnique({
      where: { uuid: input.createdByUuid },
      select: { id: true },
    }),
    input.reporterUserUuid
      ? prisma.user.findUnique({ where: { uuid: input.reporterUserUuid }, select: { id: true } })
      : Promise.resolve(null),
    input.assigneeUserUuid
      ? prisma.user.findUnique({ where: { uuid: input.assigneeUserUuid }, select: { id: true } })
      : Promise.resolve(null),
    input.parentTaskUuid
      ? prisma.task.findUnique({
          where: { uuid: input.parentTaskUuid },
          select: { id: true, projectId: true },
        })
      : Promise.resolve(null),
  ]);

  if (!creator) {
    throw new Error('UsuÃ¡rio criador da tarefa nÃ£o encontrado.');
  }

  if (input.reporterUserUuid && !reporter) {
    throw new Error('UsuÃ¡rio reporter nÃ£o encontrado.');
  }

  if (input.assigneeUserUuid && !assigneeUser) {
    throw new Error('UsuÃ¡rio responsÃ¡vel nÃ£o encontrado.');
  }

  if (input.parentTaskUuid && (!parentTask || parentTask.projectId !== project.id)) {
    throw new Error('Tarefa pai nÃ£o encontrada neste projeto.');
  }

  const task = await prisma.task.create({
    data: {
      uuid: randomUUID(),
      projectId: project.id,
      parentTaskId: parentTask?.id || null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      taskType: input.taskType || 'task',
      status: input.status || 'backlog',
      priority: input.priority || 'medium',
      assigneeType:
        input.assigneeType ||
        (input.assigneeAgentName ? 'agent' : input.assigneeUserUuid ? 'human' : 'unassigned'),
      assigneeUserId: assigneeUser?.id || null,
      assigneeAgentName: input.assigneeAgentName || null,
      reporterUserId: reporter?.id || null,
      position: input.position ?? 0,
      storyPoints: input.storyPoints ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      createdBy: creator.id,
      statusHistory: {
        create: {
          fromStatus: null,
          toStatus: input.status || 'backlog',
          changedByUserId: creator.id,
          note: 'Tarefa criada',
        },
      },
    },
    include: {
      ...taskListInclude,
      agentRuns: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return enrichTask(task);
}

export async function updateTask(taskUuid, input) {
  const existingTask = await prisma.task.findUnique({
    where: { uuid: taskUuid },
    select: {
      id: true,
      status: true,
      projectId: true,
      artifacts: {
        where: { isCurrent: true },
        select: {
          artifactType: true,
          isCurrent: true,
        },
      },
    },
  });

  if (!existingTask) {
    throw new Error('Tarefa nÃ£o encontrada.');
  }

  const [assigneeUser, reporterUser, changedByUser, parentTask] = await Promise.all([
    input.assigneeUserUuid
      ? prisma.user.findUnique({ where: { uuid: input.assigneeUserUuid }, select: { id: true } })
      : Promise.resolve(undefined),
    input.reporterUserUuid
      ? prisma.user.findUnique({ where: { uuid: input.reporterUserUuid }, select: { id: true } })
      : Promise.resolve(undefined),
    input.changedByUserUuid
      ? prisma.user.findUnique({ where: { uuid: input.changedByUserUuid }, select: { id: true } })
      : Promise.resolve(null),
    input.parentTaskUuid
      ? prisma.task.findUnique({
          where: { uuid: input.parentTaskUuid },
          select: { id: true, projectId: true },
        })
      : Promise.resolve(undefined),
  ]);

  if (input.assigneeUserUuid && !assigneeUser) {
    throw new Error('UsuÃ¡rio responsÃ¡vel nÃ£o encontrado.');
  }

  if (input.reporterUserUuid && !reporterUser) {
    throw new Error('UsuÃ¡rio reporter nÃ£o encontrado.');
  }

  if (input.parentTaskUuid && (!parentTask || parentTask.projectId !== existingTask.projectId)) {
    throw new Error('Tarefa pai nÃ£o encontrada neste projeto.');
  }

  const data = {};

  if (input.title !== undefined) data.title = input.title.trim();
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.taskType !== undefined) data.taskType = input.taskType;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.position !== undefined) data.position = input.position;
  if (input.storyPoints !== undefined) data.storyPoints = input.storyPoints;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.parentTaskUuid !== undefined) data.parentTaskId = parentTask?.id || null;
  if (input.reporterUserUuid !== undefined) data.reporterUserId = reporterUser?.id || null;
  if (input.assigneeUserUuid !== undefined) data.assigneeUserId = assigneeUser?.id || null;
  if (input.assigneeAgentName !== undefined) data.assigneeAgentName = input.assigneeAgentName || null;
  if (input.assigneeType !== undefined) data.assigneeType = input.assigneeType;

  const nextStatus = input.status;
  const statusChanged = nextStatus && nextStatus !== existingTask.status;

  if (statusChanged) {
    validateTaskStatusTransition(existingTask, nextStatus);
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.task.update({
        where: { id: existingTask.id },
        data: {
          ...data,
          ...(statusChanged
            ? {
                status: nextStatus,
                startedAt:
                  nextStatus === 'in_progress' && !['in_progress', 'done'].includes(existingTask.status)
                    ? new Date()
                    : undefined,
                completedAt: nextStatus === 'done' ? new Date() : nextStatus !== 'done' ? null : undefined,
              }
            : {}),
        },
      });

      if (statusChanged) {
        await tx.taskStatusHistory.create({
          data: {
            taskId: existingTask.id,
            fromStatus: existingTask.status,
            toStatus: nextStatus,
            changedByUserId: changedByUser?.id || null,
            note: input.statusNote || 'Status atualizado via API',
          },
        });
      }
    },
    {
      timeout: 15000,
    }
  );

  const updatedTask = await prisma.task.findUnique({
    where: { id: existingTask.id },
    include: {
      ...taskListInclude,
      agentRuns: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return enrichTask(updatedTask);
}

export async function createTaskComment(taskUuid, input) {
  const task = await prisma.task.findUnique({
    where: { uuid: taskUuid },
    select: { id: true },
  });

  if (!task) {
    throw new Error('Tarefa nÃ£o encontrada.');
  }

  let authorUser = null;
  if (input.authorUserUuid) {
    authorUser = await prisma.user.findUnique({
      where: { uuid: input.authorUserUuid },
      select: { id: true },
    });

    if (!authorUser) {
      throw new Error('UsuÃ¡rio autor nÃ£o encontrado.');
    }
  }

  return prisma.taskComment.create({
    data: {
      taskId: task.id,
      authorUserId: authorUser?.id || null,
      authorAgentName: input.authorAgentName || null,
      body: input.body.trim(),
    },
    include: {
      authorUser: { select: { uuid: true, name: true, email: true } },
    },
  });
}

async function ensureSystemWorkspaceAndUser() {
  const email = 'system@factory.local';
  const workspaceName = 'Pipeline Workspace';

  const result = await bootstrapWorkspaceAndUser({
    userName: 'Aligna System',
    email,
    workspaceName,
  });

  return result;
}

export async function ensurePipelineProject(projectUuid, idea = 'Pipeline Project', userUuid = null) {
  const existingProject = await prisma.project.findUnique({
    where: { uuid: projectUuid },
    select: { id: true, uuid: true },
  });

  if (existingProject) {
    if (userUuid) {
      await assertProjectAccess(projectUuid, userUuid);
    }
    return existingProject;
  }

  let user = null;
  let workspace = null;

  if (userUuid) {
    const authUser = await prisma.user.findUnique({
      where: { uuid: userUuid },
      select: { uuid: true },
    });

    if (!authUser) {
      throw new Error('UsuÃ¡rio autenticado nÃ£o encontrado.');
    }

    workspace = await getDefaultWorkspaceForUserUuid(userUuid);
    if (!workspace?.uuid) {
      throw new Error('Nenhum workspace disponivel para criar o projeto de pipeline.');
    }

    user = authUser;
  } else {
    const systemContext = await ensureSystemWorkspaceAndUser();
    user = systemContext.user;
    workspace = systemContext.workspace;
  }

  return createProject({
    workspaceUuid: workspace.uuid,
    createdByUuid: user.uuid,
    name: String(idea || 'Pipeline Project').slice(0, 120),
    description: 'Projeto criado automaticamente pelo pipeline.',
    vision: String(idea || 'Pipeline Project'),
    status: 'active',
    forcedUuid: projectUuid,
  });
}

function normalizeBacklogLine(line) {
  return String(line || '')
    .replace(/^[-*]\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseStoryTitle(line) {
  const normalized = normalizeBacklogLine(line);
  const withPrefix = normalized.match(/^(?:US-\d+|H\d+|Story-\d+|\d+)\s*\|\s*(Como\b.+)$/i);
  if (withPrefix) {
    return withPrefix[1].trim();
  }

  if (/^Como\b/i.test(normalized) && normalized.includes('eu quero')) {
    return normalized;
  }

  return null;
}

function extractStoriesFromBacklog(backlogMarkdown) {
  if (!backlogMarkdown) return [];

  return backlogMarkdown
    .split('\n')
    .map((line) => parseStoryTitle(line))
    .filter(Boolean);
}

function extractStructuredStoriesFromBacklog(sectionContent) {
  if (!sectionContent) return [];

  const stories = [];
  const lines = String(sectionContent).split('\n');
  let currentStory = null;

  function pushCurrentStory() {
    if (!currentStory?.title) return;
    stories.push({
      title: currentStory.title.trim(),
      description: currentStory.details.join('\n').trim() || null,
    });
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (currentStory) {
        currentStory.details.push('');
      }
      continue;
    }

    if (/^FIM_DO_BACKLOG$/i.test(line)) {
      continue;
    }

    const title = parseStoryTitle(line);
    if (title) {
      pushCurrentStory();
      currentStory = {
        title,
        details: [],
      };
      continue;
    }

    if (currentStory) {
      const cleaned = line.replace(/^[-*]\s+/, '').trim();
      currentStory.details.push(cleaned);
    }
  }

  pushCurrentStory();
  return stories.filter((story) => story.title);
}

function extractMarkdownSection(content, sectionTitle) {
  const text = String(content || '');
  if (!text.trim()) return '';

  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`##+\\s+${escaped}\\s*([\\s\\S]*?)(?=\\n##+\\s+|$)`, 'i');
  const match = text.match(regex);
  return match ? String(match[1] || '').trim() : '';
}

function extractBulletLines(sectionContent, { onlyStories = false } = {}) {
  if (!sectionContent) return [];

  return String(sectionContent)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]?\s*\d*\.?\s*(?:\*\*)?/.test(line))
    .map((line) => line.replace(/^[-*]?\s*\d*\.?\s*(?:\*\*)?/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .filter((line) => {
      if (!onlyStories) return true;
      return /^(?:US-\d+\s*\|\s*)?Como\b/i.test(line);
    })
    .map((line) => line.replace(/^US-\d+\s*\|\s*/i, '').trim());
}

function extractBacklogItems(backlogMarkdown) {
  if (!backlogMarkdown) {
    return { stories: [] };
  }

  const structuredStories = extractStructuredStoriesFromBacklog(extractMarkdownSection(backlogMarkdown, 'Historias de Usuario'));
  const stories = structuredStories.length
    ? structuredStories
    : extractStoriesFromBacklog(backlogMarkdown).map((title) => ({ title, description: null }));

  return {
    stories,
  };
}

export async function importBacklogTasks(projectUuid, backlogMarkdown) {
  const project = await prisma.project.findUnique({
    where: { uuid: projectUuid },
    include: {
      creator: { select: { id: true } },
      tasks: { select: { id: true, title: true, taskType: true } },
    },
  });

  if (!project) {
    throw new Error('Projeto nÃ£o encontrado.');
  }

  const { stories } = extractBacklogItems(backlogMarkdown);
  const existingTitles = new Set(project.tasks.filter((task) => task.taskType === 'story').map((task) => task.title.trim()));

  const itemsToCreate = [
    ...stories.map((story, index) => ({
      title: story.title,
      taskType: 'story',
      assigneeType: 'agent',
      assigneeAgentName: 'requirements_analyst',
      position: index,
      description: story.description,
      note: 'Story refinada importada do backlog',
    })),
  ];

  for (const item of itemsToCreate) {
    if (existingTitles.has(item.title.trim())) continue;

    await prisma.task.create({
      data: {
        uuid: randomUUID(),
        projectId: project.id,
        title: item.title,
        description: item.description || null,
        taskType: item.taskType,
        status: 'backlog',
        priority: 'medium',
        assigneeType: item.assigneeType,
        assigneeAgentName: item.assigneeAgentName,
        position: item.position,
        createdBy: project.creator.id,
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: 'backlog',
            changedByUserId: project.creator.id,
            note: item.note,
          },
        },
      },
    });
  }

  return listProjectTasks(projectUuid);
}

export async function createTaskArtifact(taskUuid, input) {
  const task = await prisma.task.findUnique({
    where: { uuid: taskUuid },
    select: { id: true },
  });

  if (!task) {
    throw new Error('Tarefa nÃ£o encontrada.');
  }

  await prisma.taskArtifact.updateMany({
    where: {
      taskId: task.id,
      artifactType: input.artifactType,
      artifactScope: input.artifactScope || 'refinement',
      isCurrent: true,
    },
    data: {
      isCurrent: false,
    },
  });

  const latestArtifact = await prisma.taskArtifact.findFirst({
    where: {
      taskId: task.id,
      artifactType: input.artifactType,
      artifactScope: input.artifactScope || 'refinement',
    },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  return prisma.taskArtifact.create({
    data: {
      uuid: randomUUID(),
      taskId: task.id,
      taskImplementationId: input.taskImplementationId || null,
      agentRunId: input.agentRunId || null,
      artifactType: input.artifactType,
      artifactScope: input.artifactScope || 'refinement',
      title: input.title,
      content: input.content,
      contentFormat: input.contentFormat || 'markdown',
      version: (latestArtifact?.version || 0) + 1,
      isCurrent: true,
      isApproved: input.isApproved || false,
      createdByUserId: input.createdByUserId || null,
      createdByAgentName: input.createdByAgentName || null,
    },
  });
}

export async function getTaskContextByUuid(taskUuid, userUuid = null) {
  return prisma.task.findFirst({
    where: {
      uuid: taskUuid,
      ...(userUuid
        ? {
            project: {
              is: buildProjectAccessFilter(userUuid),
            },
          }
        : {}),
    },
    include: {
      project: {
        select: {
          uuid: true,
          name: true,
          description: true,
          vision: true,
          intakeConfig: true,
        },
      },
      creator: {
        select: { id: true, uuid: true, name: true, email: true },
      },
      artifacts: {
        where: { isCurrent: true, artifactScope: 'refinement' },
        orderBy: { createdAt: 'desc' },
      },
      agentRuns: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

async function getProjectRecordByUuid(projectUuid) {
  const project = await prisma.project.findUnique({
    where: { uuid: projectUuid },
    include: {
      creator: { select: { id: true } },
    },
  });

  if (!project) {
    throw new Error('Projeto nÃ£o encontrado.');
  }

  return project;
}

const stageTaskConfig = {
  project_manager: {
    title: '[SYSTEM] Backlog Master',
    artifactType: 'backlog',
    note: 'Artefato consolidado pelo Project Manager',
  },
  architect: {
    title: '[SYSTEM] Architecture Master',
    artifactType: 'architecture',
    note: 'Artefato consolidado pelo Architect',
  },
  developer: {
    title: '[SYSTEM] Development Master',
    artifactType: 'code',
    note: 'Artefato consolidado pelo Developer',
  },
};

function buildArchitectureBlockers({
  totalStories,
  pendingStories,
  hasArchitecture,
  architectureNeedsRefresh,
  architectureApproved,
}) {
  const blockers = [];

  if (!totalStories) {
    blockers.push('Crie e refine pelo menos uma historia antes de gerar a arquitetura.');
  }

  if (hasArchitecture) {
    blockers.push('A arquitetura deste projeto ja foi gerada. Para preservar a trilha tecnica, essa etapa nao pode ser executada novamente.');
  }

  if (pendingStories > 0) {
    blockers.push(`Ainda faltam ${pendingStories} historias com requisitos refinados.`);
  }

  if (!hasArchitecture) {
    blockers.push('A arquitetura do projeto ainda nao foi gerada.');
  }

  if (!hasArchitecture && architectureNeedsRefresh) {
    blockers.push('A arquitetura atual ficou desatualizada depois de novos refinamentos.');
  }

  if (hasArchitecture && !architectureNeedsRefresh && !architectureApproved) {
    blockers.push('A arquitetura atual precisa de aprovacao humana antes de liberar implementacao ou exportacao final.');
  }

  return blockers;
}

export async function getProjectArchitectureStatus(projectUuid, userUuid = null) {
  const project = await prisma.project.findFirst({
    where: {
      uuid: projectUuid,
      ...buildProjectAccessFilter(userUuid),
    },
    select: {
      id: true,
      uuid: true,
      name: true,
      description: true,
      vision: true,
      intakeConfig: true,
      tasks: {
        where: {
          taskType: 'story',
        },
        select: {
          id: true,
          uuid: true,
          title: true,
          status: true,
          taskType: true,
          artifacts: {
            where: {
              isCurrent: true,
              artifactScope: 'refinement',
              artifactType: {
                in: ['requirements', 'test_plan'],
              },
            },
            select: {
              id: true,
              uuid: true,
              artifactType: true,
              title: true,
              content: true,
              version: true,
              createdAt: true,
              isCurrent: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!project) {
    throw new Error('Projeto nÃ£o encontrado.');
  }

  const architectureTask = await prisma.task.findFirst({
    where: {
      projectId: project.id,
      title: stageTaskConfig.architect.title,
    },
    select: {
      uuid: true,
      artifacts: {
        where: {
          artifactType: 'architecture',
          artifactScope: 'refinement',
          isCurrent: true,
        },
        select: {
          uuid: true,
          title: true,
          content: true,
          version: true,
          createdAt: true,
          isCurrent: true,
          isApproved: true,
          approvedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const totalStories = project.tasks.length;
  const refinedTasks = project.tasks.filter((task) =>
    task.artifacts.some((artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent)
  );
  const refinedStories = refinedTasks.length;
  const pendingTasks = project.tasks.filter(
    (task) => !task.artifacts.some((artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent)
  );
  const pendingStories = pendingTasks.length;
  const allStoriesRefined = totalStories > 0 && pendingStories === 0;

  const architectureArtifact = architectureTask?.artifacts?.[0] || null;
  const hasArchitecture = Boolean(architectureArtifact);
  const architectureApproved = Boolean(architectureArtifact?.isApproved);
  const architectureNeedsRefresh = false;
  const canGenerateArchitecture = allStoriesRefined && !hasArchitecture;
  const canGenerateCode = allStoriesRefined && hasArchitecture && architectureApproved;
  const blockers = buildArchitectureBlockers({
    totalStories,
    pendingStories,
    hasArchitecture,
    architectureNeedsRefresh,
    architectureApproved,
  });

  return {
    projectUuid: project.uuid,
    projectName: project.name,
    totalStories,
    refinedStories,
    pendingStories,
    allStoriesRefined,
    canGenerateArchitecture,
    hasArchitecture,
    architectureApproved,
    architectureNeedsRefresh,
    canGenerateCode,
    blockers,
    pendingTasks: pendingTasks.map((task) => ({
      uuid: task.uuid,
      title: task.title,
      status: task.status,
    })),
    architectureArtifact: architectureArtifact
      ? {
          ...architectureArtifact,
          taskUuid: architectureTask?.uuid || null,
          preview: String(architectureArtifact.content || '').slice(0, 600),
        }
      : null,
  };
}

export async function approveCurrentArchitectureArtifact(projectUuid, approvedByUserUuid) {
  const project = await prisma.project.findFirst({
    where: {
      uuid: projectUuid,
      ...buildProjectAccessFilter(approvedByUserUuid),
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    throw new Error('Projeto nÃ£o encontrado.');
  }

  const approvedByUser = await prisma.user.findUnique({
    where: { uuid: approvedByUserUuid },
    select: { id: true },
  });

  if (!approvedByUser?.id) {
    throw new Error('UsuÃ¡rio aprovador nÃ£o encontrado.');
  }

  const architectureTask = await prisma.task.findFirst({
    where: {
      projectId: project.id,
      title: stageTaskConfig.architect.title,
    },
    select: {
      id: true,
      status: true,
      artifacts: {
        where: {
          artifactType: 'architecture',
          artifactScope: 'refinement',
          isCurrent: true,
        },
        select: {
          id: true,
          version: true,
          isApproved: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const currentArtifact = architectureTask?.artifacts?.[0];
  if (!architectureTask || !currentArtifact) {
    throw new Error('Nenhum artefato de arquitetura atual encontrado para aprovaÃ§Ã£o.');
  }

  const approvedArtifact = await prisma.taskArtifact.update({
    where: { id: currentArtifact.id },
    data: {
      isApproved: true,
      approvedBy: approvedByUser.id,
      approvedAt: new Date(),
    },
    select: {
      uuid: true,
      version: true,
      isApproved: true,
      approvedAt: true,
    },
  });

  await prisma.taskStatusHistory.create({
    data: {
      taskId: architectureTask.id,
      fromStatus: architectureTask.status,
      toStatus: architectureTask.status,
      changedByUserId: approvedByUser.id,
      note: `Arquitetura aprovada manualmente (artefato v${approvedArtifact.version}).`,
    },
  });

  return approvedArtifact;
}

export async function getProjectDocumentationBundle(projectUuid, userUuid = null) {
  const [project, tasks, architectureStatus] = await Promise.all([
    getProjectByUuid(projectUuid, userUuid),
    listProjectTasks(projectUuid, {}, userUuid),
    getProjectArchitectureStatus(projectUuid, userUuid),
  ]);

  if (!project) {
    throw new Error('Projeto nÃ£o encontrado.');
  }

  const backlogTask = await prisma.task.findFirst({
    where: {
      projectId: project.id,
      title: stageTaskConfig.project_manager.title,
    },
    select: {
      uuid: true,
      artifacts: {
        where: {
          artifactType: 'backlog',
          artifactScope: 'refinement',
          isCurrent: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const backlogArtifact = backlogTask?.artifacts?.[0] || null;

  return {
    generatedAt: new Date().toISOString(),
    project: {
      uuid: project.uuid,
      name: project.name,
      description: project.description,
      vision: project.vision,
      status: project.status,
      workspace: project.workspace,
      creator: project.creator,
      intakeConfig: project.intakeConfig || null,
    },
    summary: {
      totalTasks: tasks.length,
      totalEpics: tasks.filter((task) => task.taskType === 'epic').length,
      totalStories: tasks.filter((task) => task.taskType === 'story').length,
      totalTechnicalTasks: tasks.filter((task) => task.taskType === 'task').length,
      refinedStories: architectureStatus.refinedStories || 0,
      storiesWithTestPlan: tasks.filter((task) =>
        (task.artifacts || []).some((artifact) => artifact.artifactType === 'test_plan' && artifact.isCurrent)
      ).length,
      hasBacklog: Boolean(backlogArtifact),
      hasArchitecture: Boolean(architectureStatus.architectureArtifact),
    },
    backlogArtifact,
    architectureArtifact: architectureStatus.architectureArtifact || null,
    architectureStatus,
    tasks: tasks.map((task) => ({
      uuid: task.uuid,
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      status: task.status,
      priority: task.priority,
      assigneeAgentName: task.assigneeAgentName,
      artifacts: (task.artifacts || []).map((artifact) => ({
        uuid: artifact.uuid,
        artifactType: artifact.artifactType,
        title: artifact.title,
        content: artifact.content,
        version: artifact.version,
        createdAt: artifact.createdAt,
        isCurrent: artifact.isCurrent,
      })),
    })),
  };
}

export async function ensureStageTask(projectUuid, agentName) {
  const config = stageTaskConfig[agentName];
  if (!config) return null;

  const project = await getProjectRecordByUuid(projectUuid);

  const existingTask = await prisma.task.findFirst({
    where: {
      projectId: project.id,
      title: config.title,
    },
    include: taskListInclude,
  });

  if (existingTask) {
    return existingTask;
  }

  return prisma.task.create({
    data: {
      uuid: randomUUID(),
      projectId: project.id,
      title: config.title,
      description: config.note,
      taskType: 'agent_job',
      status: 'done',
      priority: 'medium',
      assigneeType: 'agent',
      assigneeAgentName: agentName,
      createdBy: project.creator.id,
      statusHistory: {
        create: {
          fromStatus: null,
          toStatus: 'done',
          changedByUserId: project.creator.id,
          note: config.note,
        },
      },
    },
    include: taskListInclude,
  });
}

export async function createAgentRunStart(projectUuid, agentName, payload = {}) {
  const project = await prisma.project.findUnique({
    where: { uuid: projectUuid },
    select: { id: true },
  });

  if (!project) {
    throw new Error('Projeto nÃ£o encontrado.');
  }

  let taskId = null;
  if (payload.task_uuid) {
    const task = await prisma.task.findUnique({
      where: { uuid: payload.task_uuid },
      select: { id: true },
    });
    taskId = task?.id || null;
  }

  const blockingRunRecoveryWindowSeconds = Number(
    process.env.AGENT_RUN_BLOCKING_RECOVERY_WINDOW_SECONDS || 180
  );
  await recoverBlockingAgentRunsForStart({
    projectId: project.id,
    agentName,
    taskId,
    maxAgeSeconds: blockingRunRecoveryWindowSeconds,
  });

  const existingRunningRun = await prisma.agentRun.findFirst({
    where: {
      projectId: project.id,
      agentName,
      taskId,
      status: 'running',
    },
    select: {
      uuid: true,
      createdAt: true,
    },
  });

  if (existingRunningRun) {
    throw new Error(
      `Ja existe uma execucao em andamento para ${agentName}${payload.task_uuid ? ' nesta task' : ' neste projeto'} (run ${existingRunningRun.uuid}).`
    );
  }

  return prisma.agentRun.create({
    data: {
      uuid: randomUUID(),
      projectId: project.id,
      taskId,
      agentName,
      triggerType: 'manual',
      inputPayload: JSON.stringify(payload),
      outputFormat: 'markdown',
      status: 'running',
      startedAt: new Date(),
    },
  });
}

export async function finishAgentRun(agentRunId, { status, result, errorMessage, usageMeta = null }) {
  const existingRun = await prisma.agentRun.findUnique({
    where: { id: agentRunId },
    select: { inputPayload: true },
  });

  const outputText = result
    ? typeof result === 'string'
      ? result
      : JSON.stringify(result, null, 2)
    : null;

  return prisma.agentRun.update({
    where: { id: agentRunId },
    data: {
      status,
      outputText,
      errorMessage: errorMessage || null,
      tokensInput: usageMeta?.tokensInput ?? estimateTokenCount(existingRun?.inputPayload || ''),
      tokensOutput: usageMeta?.tokensOutput ?? estimateTokenCount(outputText || ''),
      costUsd: usageMeta?.costUsd ?? null,
      finishedAt: new Date(),
    },
  });
}

export async function restoreTaskAfterAgentFailure(taskUuid, previousState, { changedByUserUuid, failedAgentName, errorMessage }) {
  const existingTask = await prisma.task.findUnique({
    where: { uuid: taskUuid },
    select: { id: true, status: true },
  });

  if (!existingTask) {
    throw new Error('Tarefa nÃ£o encontrada.');
  }

  const changedByUser = changedByUserUuid
    ? await prisma.user.findUnique({
        where: { uuid: changedByUserUuid },
        select: { id: true },
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: existingTask.id },
      data: {
        status: previousState.status,
        assigneeType: previousState.assigneeType || 'unassigned',
        assigneeUserId: previousState.assigneeUserId || null,
        assigneeAgentName: previousState.assigneeAgentName || null,
        startedAt: previousState.startedAt || null,
        completedAt: previousState.completedAt || null,
        currentArtifactSummary: previousState.currentArtifactSummary || null,
      },
    });

    await tx.taskStatusHistory.create({
      data: {
        taskId: existingTask.id,
        fromStatus: existingTask.status,
        toStatus: previousState.status,
        changedByUserId: changedByUser?.id || null,
        note: `Falha ao executar ${failedAgentName}. Task retornada para ${previousState.status}. Erro: ${String(errorMessage || 'Sem detalhes').slice(0, 420)}`,
      },
    });
  });

  const updatedTask = await prisma.task.findUnique({
    where: { id: existingTask.id },
    include: {
      ...taskListInclude,
      agentRuns: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return enrichTask(updatedTask);
}

export async function persistAgentResult(projectUuid, agentName, payload, result) {
  if (!projectUuid || !stageTaskConfig[agentName]) return null;

  if (payload?.task_uuid) {
    return null;
  }

  const config = stageTaskConfig[agentName];
  const stageTask = await ensureStageTask(projectUuid, agentName);
  const content =
    typeof result === 'string'
      ? result
      : agentName === 'developer' && result?.code
        ? result.code
        : JSON.stringify(result, null, 2);

  const artifact = await createTaskArtifact(stageTask.uuid, {
    artifactType: config.artifactType,
    title: config.title,
    content,
    contentFormat: 'markdown',
    createdByAgentName: agentName,
  });

  if (agentName === 'project_manager') {
    await importBacklogTasks(projectUuid, content);
  }

  return artifact;
}
