import { describe, it, expect, beforeEach } from 'vitest';
import { MockStorage } from '../../../mocks/mock-storage';
import { LocalStorageAdapter } from '@/data/storage';
import {
  LocalStorageTaskRepository,
  LocalStorageGroupRepository,
  LocalStorageTagRepository,
} from '@/data/repositories';
import {
  useTasksStore,
  configureTasksStore,
  resetTasksStore,
} from '@/features/tasks/store/tasks-store';
import { SEED_PERSONAL_GROUP, type Group } from '@/shared/schemas';

describe('useTasksStore (unit/features/tasks/tasks-store)', () => {
  let mockStorage: MockStorage;
  let adapter: LocalStorageAdapter;
  let taskRepository: LocalStorageTaskRepository;
  let groupRepository: LocalStorageGroupRepository;
  let tagRepository: LocalStorageTagRepository;

  const workGroup: Group = {
    id: 'grp-work',
    name: 'Trabajo',
    creatorId: 'local-user',
    isPersonal: false,
    type: 'individual',
    members: [
      {
        userId: 'local-user',
        role: 'creator',
        joinedAt: '2026-11-01T10:00:00.000Z',
      },
    ],
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  beforeEach(() => {
    mockStorage = new MockStorage();
    adapter = new LocalStorageAdapter(mockStorage);
    taskRepository = new LocalStorageTaskRepository(adapter);
    groupRepository = new LocalStorageGroupRepository(adapter);
    tagRepository = new LocalStorageTagRepository(adapter);

    configureTasksStore({
      taskRepository,
      groupRepository,
      tagRepository,
    });
    resetTasksStore();
  });

  it('should initialize store with SEED_PERSONAL_GROUP when storage is empty', async () => {
    await useTasksStore.getState().init();

    const state = useTasksStore.getState();
    expect(state.groups).toHaveLength(1);
    expect(state.groups[0].id).toBe(SEED_PERSONAL_GROUP.id);
    expect(state.activeGroupId).toBe(SEED_PERSONAL_GROUP.id);
    expect(state.tasks).toEqual([]);
    expect(state.tags).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it('should create task with auto id, createdAt, completed false, and synchronize tags', async () => {
    await useTasksStore.getState().init();

    const created = await useTasksStore.getState().createTask({
      title: 'Aprender TanStack Router',
      description: 'Revisar documentación y tutoriales',
      dueDate: '2026-11-20',
      dueTime: '15:00',
      tagNames: ['Frontend', 'Estudio'],
      groupId: SEED_PERSONAL_GROUP.id,
    });

    expect(created.id).toBeDefined();
    expect(created.createdAt).toBeDefined();
    expect(created.completed).toBe(false);
    expect(created.completedAt).toBeNull();
    expect(created.tagIds).toHaveLength(2);

    const state = useTasksStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].title).toBe('Aprender TanStack Router');
    expect(state.tags).toHaveLength(2);
    expect(state.tags.map((t) => t.name)).toEqual(
      expect.arrayContaining(['Frontend', 'Estudio']),
    );
  });

  it('should update task while preserving immutable id, createdAt, and groupId', async () => {
    await useTasksStore.getState().init();

    const created = await useTasksStore.getState().createTask({
      title: 'Tarea original',
      description: 'Desc original',
      tagNames: ['Frontend'],
      groupId: SEED_PERSONAL_GROUP.id,
    });

    const updated = await useTasksStore.getState().updateTask(created.id, {
      title: 'Tarea modificada',
      description: 'Nueva descripción',
      dueDate: '2026-11-25',
      tagNames: ['Frontend', 'Urgente'],
    });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.groupId).toBe(created.groupId);
    expect(updated.title).toBe('Tarea modificada');
    expect(updated.description).toBe('Nueva descripción');
    expect(updated.dueDate).toBe('2026-11-25');
    expect(updated.tagIds).toHaveLength(2);

    const state = useTasksStore.getState();
    expect(state.tasks[0].title).toBe('Tarea modificada');
    expect(state.tags.map((t) => t.name)).toContain('Urgente');
  });

  it('should delete task from state and storage', async () => {
    await useTasksStore.getState().init();

    const created = await useTasksStore.getState().createTask({
      title: 'Tarea para borrar',
      groupId: SEED_PERSONAL_GROUP.id,
    });
    expect(useTasksStore.getState().tasks).toHaveLength(1);

    await useTasksStore.getState().deleteTask(created.id);
    expect(useTasksStore.getState().tasks).toHaveLength(0);

    const inRepo = await taskRepository.getById(created.id);
    expect(inRepo).toBeNull();
  });

  it('should toggle task completion state and set/clear completedAt timestamp', async () => {
    await useTasksStore.getState().init();

    const created = await useTasksStore.getState().createTask({
      title: 'Tarea pendiente',
      groupId: SEED_PERSONAL_GROUP.id,
    });
    expect(created.completed).toBe(false);
    expect(created.completedAt).toBeNull();

    // Toggle complete: sets completed = true, completedAt = ISO
    await useTasksStore.getState().toggleTaskComplete(created.id);
    let currentTask = useTasksStore.getState().tasks.find((t) => t.id === created.id);
    expect(currentTask?.completed).toBe(true);
    expect(currentTask?.completedAt).toBeTruthy();

    // Toggle back: sets completed = false, completedAt = null
    await useTasksStore.getState().toggleTaskComplete(created.id);
    currentTask = useTasksStore.getState().tasks.find((t) => t.id === created.id);
    expect(currentTask?.completed).toBe(false);
    expect(currentTask?.completedAt).toBeNull();
  });

  it('should move task to another group, preserving id and createdAt, and synchronizing tags', async () => {
    await groupRepository.save(workGroup);
    await useTasksStore.getState().init();

    const created = await useTasksStore.getState().createTask({
      title: 'Mover al trabajo',
      tagNames: ['Importante'],
      groupId: SEED_PERSONAL_GROUP.id,
    });

    await useTasksStore.getState().moveTask(created.id, 'grp-work');

    // In current personal group, task is removed
    expect(useTasksStore.getState().tasks).toHaveLength(0);

    // In target group in repository, task exists with same id and createdAt
    const movedInRepo = await taskRepository.getById(created.id);
    expect(movedInRepo).not.toBeNull();
    expect(movedInRepo?.id).toBe(created.id);
    expect(movedInRepo?.createdAt).toBe(created.createdAt);
    expect(movedInRepo?.groupId).toBe('grp-work');

    // Tag 'Importante' exists in target group
    const targetTag = await tagRepository.findByName('grp-work', 'Importante');
    expect(targetTag).not.toBeNull();
    expect(movedInRepo?.tagIds).toEqual([targetTag!.id]);
  });

  it('should copy task to another group with new id, new createdAt, and synchronizing tags', async () => {
    await groupRepository.save(workGroup);
    await useTasksStore.getState().init();

    const created = await useTasksStore.getState().createTask({
      title: 'Copiar al trabajo',
      description: 'Instrucciones duplicadas',
      tagNames: ['Importante'],
      groupId: SEED_PERSONAL_GROUP.id,
    });

    const copied = await useTasksStore.getState().copyTask(created.id, 'grp-work');

    // Original task remains in personal group
    expect(useTasksStore.getState().tasks).toHaveLength(1);
    expect(useTasksStore.getState().tasks[0].id).toBe(created.id);

    // Copied task has new id and belongs to grp-work
    expect(copied.id).not.toBe(created.id);
    expect(copied.groupId).toBe('grp-work');
    expect(copied.title).toBe('Copiar al trabajo');
    expect(copied.description).toBe('Instrucciones duplicadas');

    // Target group has the tag synced
    const targetTag = await tagRepository.findByName('grp-work', 'Importante');
    expect(targetTag).not.toBeNull();
    expect(copied.tagIds).toEqual([targetTag!.id]);
  });

  it('should remove tag only from task (Solo de la tarea)', async () => {
    await useTasksStore.getState().init();

    const created = await useTasksStore.getState().createTask({
      title: 'Tarea con dos etiquetas',
      tagNames: ['Frontend', 'Backend'],
      groupId: SEED_PERSONAL_GROUP.id,
    });
    const frontendTag = useTasksStore.getState().tags.find((t) => t.name === 'Frontend')!;

    await useTasksStore.getState().removeTagFromTask(created.id, frontendTag.id);

    const taskAfter = useTasksStore.getState().tasks.find((t) => t.id === created.id)!;
    expect(taskAfter.tagIds).not.toContain(frontendTag.id);

    // Tag still exists in group tags catalog
    const allTags = await tagRepository.getAll();
    expect(allTags.some((t) => t.id === frontendTag.id)).toBe(true);
  });

  it('should delete tag from group and strip from all group tasks (Del grupo)', async () => {
    await useTasksStore.getState().init();

    const task1 = await useTasksStore.getState().createTask({
      title: 'Tarea 1',
      tagNames: ['Compartida'],
      groupId: SEED_PERSONAL_GROUP.id,
    });
    const task2 = await useTasksStore.getState().createTask({
      title: 'Tarea 2',
      tagNames: ['Compartida'],
      groupId: SEED_PERSONAL_GROUP.id,
    });

    const sharedTag = useTasksStore.getState().tags.find((t) => t.name === 'Compartida')!;

    await useTasksStore.getState().deleteTagFromGroup(sharedTag.id);

    const state = useTasksStore.getState();
    expect(state.tags.some((t) => t.id === sharedTag.id)).toBe(false);

    const t1After = state.tasks.find((t) => t.id === task1.id)!;
    const t2After = state.tasks.find((t) => t.id === task2.id)!;
    expect(t1After.tagIds).not.toContain(sharedTag.id);
    expect(t2After.tagIds).not.toContain(sharedTag.id);
  });

  it('should manage active filter, active group, and modal states', async () => {
    await groupRepository.save(workGroup);
    await useTasksStore.getState().init();

    // Filters
    expect(useTasksStore.getState().activeFilter).toBe('pendientes');
    useTasksStore.getState().setActiveFilter('completadas');
    expect(useTasksStore.getState().activeFilter).toBe('completadas');

    // Modals
    expect(useTasksStore.getState().modalState.type).toBeNull();
    useTasksStore.getState().openModal('create');
    expect(useTasksStore.getState().modalState).toEqual({
      type: 'create',
      taskId: null,
      tagId: null,
      tagName: null,
    });

    useTasksStore.getState().openModal('edit', 'task-1');
    expect(useTasksStore.getState().modalState).toEqual({
      type: 'edit',
      taskId: 'task-1',
      tagId: null,
      tagName: null,
    });

    useTasksStore.getState().openModal('tagRemoval', 'task-1', {
      tagId: 'tag-1',
      tagName: 'Frontend',
    });
    expect(useTasksStore.getState().modalState).toEqual({
      type: 'tagRemoval',
      taskId: 'task-1',
      tagId: 'tag-1',
      tagName: 'Frontend',
    });

    useTasksStore.getState().closeModal();
    expect(useTasksStore.getState().modalState).toEqual({
      type: null,
      taskId: null,
      tagId: null,
      tagName: null,
    });

    // Active group switch
    await useTasksStore.getState().setActiveGroup('grp-work');
    expect(useTasksStore.getState().activeGroupId).toBe('grp-work');
  });
});
