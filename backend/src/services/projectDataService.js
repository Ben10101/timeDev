import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';

const taskListInclude = {
  assigneeUser: { select: { uuid: true, name: true, email: true } },
  reporterUser: { select: { uuid: true, name: true, email: true } },
  creator: { select: { uuid: true, name: true, email: true } },
  artifacts: {
    where: { isCurrent: true, artifactScope: 'refinement' },
    orderBy: { createdAt: 'desc' },
  },
  _count: { select: { artifacts: true, comments: true, checklistItems: true } },
};

const taskDetailInclude = {
  ...taskListInclude,
  project: {
    select: { uuid: true, name: true, slug: true, status: true },
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
  const cycleTimeSeconds = task.startedAt ? getDurationSeconds(task.startedAt, task.completedAt || now) : 0;

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

  return {
    leadTimeSeconds,
    cycleTimeSeconds,
    requirementsTimeSeconds: byAgent.requirements_analyst?.totalDurationSeconds || 0,
    qaTimeSeconds: byAgent.qa_engineer?.totalDurationSeconds || 0,
    byAgent: Object.values(byAgent),
  };
}

function enrichTask(task) {
  if (!task) return task;
  return {
    ...task,
    timing: buildTaskTiming(task),
  };
}

const workflowOrder = ['backlog', 'todo', 'in_progress', 'in_review', 'qa', 'done'];

function hasCurrentArtifact(task, artifactType) {
  return (task.artifacts || []).some((artifact) => artifact.artifactType === artifactType && artifact.isCurrent);
}

function validateTaskStatusTransition(existingTask, nextStatus) {
  if (!nextStatus || nextStatus === existingTask.status) return;

  if (nextStatus === 'blocked' || nextStatus === 'archived') return;

  const currentIndex = workflowOrder.indexOf(existingTask.status);
  const nextIndex = workflowOrder.indexOf(nextStatus);

  if (currentIndex !== -1 && nextIndex !== -1 && nextIndex < currentIndex) {
    throw new Error('Não é permitido voltar a tarefa para uma etapa anterior.');
  }

  if (nextStatus === 'qa' && !hasCurrentArtifact(existingTask, 'requirements')) {
    throw new Error('A tarefa só pode seguir para QA depois que os requisitos estiverem processados.');
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
    throw new Error('Workspace nao encontrado ou sem permissao de acesso.');
  }

  return workspace;
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
    throw new Error('Projeto nao encontrado ou sem permissao de acesso.');
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
    throw new Error('Tarefa nao encontrada ou sem permissao de acesso.');
  }

  return task;
}

export async function listProjects(userUuid = null) {
  return prisma.project.findMany({
    where: buildProjectAccessFilter(userUuid),
    orderBy: { createdAt: 'desc' },
    include: {
      workspace: {
        select: { uuid: true, name: true, slug: true },
      },
      creator: {
        select: { uuid: true, name: true, email: true },
      },
      _count: {
        select: { tasks: true, agentRuns: true },
      },
    },
  });
}

export async function bootstrapWorkspaceAndUser({ userName, email, workspaceName, passwordHash = null, failIfUserExists = false }) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedWorkspaceName = workspaceName.trim();
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
        throw new Error('Já existe um usuário com este e-mail.');
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
  return prisma.project.findFirst({
    where: {
      uuid: projectUuid,
      ...buildProjectAccessFilter(userUuid),
    },
    include: {
      workspace: {
        select: { uuid: true, name: true, slug: true },
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
        orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
        include: {
          _count: {
            select: { artifacts: true, comments: true, checklistItems: true },
          },
        },
      },
    },
  });
}

export async function updateProjectBrief(projectUuid, input = {}) {
  const existingProject = await prisma.project.findUnique({
    where: { uuid: projectUuid },
    select: { id: true, intakeConfig: true },
  });

  if (!existingProject) {
    throw new Error('Projeto não encontrado.');
  }

  return prisma.project.update({
    where: { uuid: projectUuid },
    data: {
      description: input.description !== undefined ? input.description?.trim() || null : undefined,
      vision: input.vision !== undefined ? input.vision?.trim() || null : undefined,
      intakeConfig:
        input.intakeConfig !== undefined
          ? {
              ...(existingProject.intakeConfig || {}),
              ...input.intakeConfig,
            }
          : undefined,
    },
  });
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
    throw new Error('Workspace não encontrado.');
  }

  if (!user) {
    throw new Error('Usuário criador não encontrado.');
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

  return prisma.project.create({
    data: {
      uuid: forcedUuid || randomUUID(),
      workspaceId: workspace.id,
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      vision: vision?.trim() || null,
      startMode: startMode?.trim() || null,
      templateKey: templateKey?.trim() || null,
      intakeConfig: intakeConfig ?? undefined,
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
    throw new Error('Projeto não encontrado.');
  }

  let parentTaskId;
  if (parentTaskUuid) {
    const parentTask = await prisma.task.findUnique({
      where: { uuid: parentTaskUuid },
      select: { id: true, projectId: true },
    });

    if (!parentTask || parentTask.projectId !== project.id) {
      throw new Error('Tarefa pai não encontrada neste projeto.');
    }
    parentTaskId = parentTask.id;
  }

  const tasks = await prisma.task.findMany({
    where: {
      projectId: project.id,
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

  return tasks.map(enrichTask);
}

export async function listAllTasks({ status } = {}, userUuid = null) {
  const tasks = await prisma.task.findMany({
    where: {
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

  return tasks.map(enrichTask);
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

  return enrichTask(task);
}

export async function createTask(projectUuid, input) {
  const project = await prisma.project.findUnique({
    where: { uuid: projectUuid },
    select: { id: true },
  });

  if (!project) {
    throw new Error('Projeto não encontrado.');
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
    throw new Error('Usuário criador da tarefa não encontrado.');
  }

  if (input.reporterUserUuid && !reporter) {
    throw new Error('Usuário reporter não encontrado.');
  }

  if (input.assigneeUserUuid && !assigneeUser) {
    throw new Error('Usuário responsável não encontrado.');
  }

  if (input.parentTaskUuid && (!parentTask || parentTask.projectId !== project.id)) {
    throw new Error('Tarefa pai não encontrada neste projeto.');
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
    throw new Error('Tarefa não encontrada.');
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
    throw new Error('Usuário responsável não encontrado.');
  }

  if (input.reporterUserUuid && !reporterUser) {
    throw new Error('Usuário reporter não encontrado.');
  }

  if (input.parentTaskUuid && (!parentTask || parentTask.projectId !== existingTask.projectId)) {
    throw new Error('Tarefa pai não encontrada neste projeto.');
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
    throw new Error('Tarefa não encontrada.');
  }

  let authorUser = null;
  if (input.authorUserUuid) {
    authorUser = await prisma.user.findUnique({
      where: { uuid: input.authorUserUuid },
      select: { id: true },
    });

    if (!authorUser) {
      throw new Error('Usuário autor não encontrado.');
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
    userName: 'Factory System',
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
      throw new Error('Usuario autenticado nao encontrado.');
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

function extractStoriesFromBacklog(backlogMarkdown) {
  if (!backlogMarkdown) return [];

  return backlogMarkdown
    .split('\n')
    .filter((line) => line.trim().match(/^[-*]?\s*\d*\.?\s*(?:\*\*)?Como\b/i))
    .map((text) =>
      text
        .replace(/^[-*]?\s*\d*\.?\s*(?:\*\*)?/, '')
        .replace(/\*\*/g, '')
        .trim()
    )
    .filter(Boolean);
}

export async function importBacklogTasks(projectUuid, backlogMarkdown) {
  const project = await prisma.project.findUnique({
    where: { uuid: projectUuid },
    include: {
      creator: { select: { id: true } },
      tasks: { select: { id: true, title: true } },
    },
  });

  if (!project) {
    throw new Error('Projeto não encontrado.');
  }

  const stories = extractStoriesFromBacklog(backlogMarkdown);
  const existingTitles = new Set(project.tasks.map((task) => task.title.trim()));

  for (const [index, title] of stories.entries()) {
    if (existingTitles.has(title.trim())) continue;

    await prisma.task.create({
      data: {
        uuid: randomUUID(),
        projectId: project.id,
        title,
        description: null,
        taskType: 'story',
        status: 'backlog',
        priority: 'medium',
        assigneeType: 'agent',
        assigneeAgentName: 'requirements_analyst',
        position: index,
        createdBy: project.creator.id,
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: 'backlog',
            changedByUserId: project.creator.id,
            note: 'Task importada do backlog',
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
    throw new Error('Tarefa não encontrada.');
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
    throw new Error('Projeto não encontrado.');
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
    throw new Error('Projeto não encontrado.');
  }

  let taskId = null;
  if (payload.task_uuid) {
    const task = await prisma.task.findUnique({
      where: { uuid: payload.task_uuid },
      select: { id: true },
    });
    taskId = task?.id || null;
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

export async function finishAgentRun(agentRunId, { status, result, errorMessage }) {
  return prisma.agentRun.update({
    where: { id: agentRunId },
    data: {
      status,
      outputText: result
        ? typeof result === 'string'
          ? result
          : JSON.stringify(result, null, 2)
        : null,
      errorMessage: errorMessage || null,
      finishedAt: new Date(),
    },
  });
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
