import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockStorage } from '../../../mocks/mock-storage';
import { LocalStorageAdapter } from '@/data/storage';
import {
  LocalStorageTaskRepository,
  LocalStorageGroupRepository,
  LocalStorageTagRepository,
} from '@/data/repositories';
import {
  configureTasksStore,
  resetTasksStore,
  useTasksStore,
} from '@/features/tasks/store/tasks-store';
import {
  configureGroupsStore,
  resetGroupsStore,
} from '@/features/groups/store/groups-store';
import { GroupsGridView } from '@/features/groups/components/GroupsGridView';
import { TaskFormModal } from '@/features/tasks/components/TaskFormModal';
import { SEED_PERSONAL_GROUP, type Group } from '@/shared/schemas';
import { es } from '@/shared/i18n';

describe('Tag Removal & Multi-Group Integration Flows (integration/features/tags)', () => {
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

  beforeEach(async () => {
    mockStorage = new MockStorage();
    adapter = new LocalStorageAdapter(mockStorage);
    taskRepository = new LocalStorageTaskRepository(adapter);
    groupRepository = new LocalStorageGroupRepository(adapter);
    tagRepository = new LocalStorageTagRepository(adapter);

    configureTasksStore({ taskRepository, groupRepository, tagRepository });
    configureGroupsStore({ taskRepository, groupRepository, tagRepository });
    resetTasksStore();
    resetGroupsStore();

    await groupRepository.ensureSeedGroup();
    await groupRepository.save(workGroup);
    await useTasksStore.getState().init();
  });

  it('removes tag from TaskCard via "Solo de la tarea" and "Del grupo" in GroupsGridView (AC-TG-08, AC-TG-09)', async () => {
    const user = userEvent.setup();

    await useTasksStore.getState().createTask({
      title: 'Tarea A',
      tagNames: ['Compartida', 'Unica'],
      groupId: SEED_PERSONAL_GROUP.id,
    });
    await useTasksStore.getState().createTask({
      title: 'Tarea B',
      tagNames: ['Compartida'],
      groupId: SEED_PERSONAL_GROUP.id,
    });

    render(<GroupsGridView />);
    await screen.findByText('Tarea A');

    // Remove 'Unica' via "Solo de la tarea"
    await user.click(screen.getByRole('button', { name: es.tasks.removeTagAria('Unica') }));
    expect(screen.getByText(es.tasks.removeTagDescription)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: es.tasks.removeOnlyFromTask }));

    expect(screen.queryByRole('button', { name: es.tasks.removeTagAria('Unica') })).not.toBeInTheDocument();
    // Tag 'Unica' remains in group catalog
    const unicaInRepo = await tagRepository.findByName(SEED_PERSONAL_GROUP.id, 'Unica');
    expect(unicaInRepo).not.toBeNull();

    // Remove 'Compartida' via "Del grupo"
    const removeCompartidaButtons = screen.getAllByRole('button', {
      name: es.tasks.removeTagAria('Compartida'),
    });
    await user.click(removeCompartidaButtons[0]);
    await user.click(screen.getByRole('button', { name: es.tasks.removeFromGroup }));

    expect(screen.queryAllByRole('button', { name: es.tasks.removeTagAria('Compartida') })).toHaveLength(0);
    const compartidaInRepo = await tagRepository.findByName(SEED_PERSONAL_GROUP.id, 'Compartida');
    expect(compartidaInRepo).toBeNull();
  });

  it('preserves unsaved title and session tag when removing a persisted tag inside TaskFormModal, and persists removal even if cancelled (AC-TG-07)', async () => {
    const user = userEvent.setup();
    const task = await useTasksStore.getState().createTask({
      title: 'Título original',
      tagNames: ['Persistida'],
      groupId: SEED_PERSONAL_GROUP.id,
    });

    const onClose = () => {};
    render(
      <TaskFormModal
        show={true}
        task={task}
        onClose={onClose}
      />,
    );

    const titleInput = screen.getByLabelText(es.tasks.titleLabel);
    await user.clear(titleInput);
    await user.type(titleInput, 'Título editado sin guardar');

    const tagInput = screen.getByPlaceholderText(es.tasks.tagsPlaceholder);
    await user.type(tagInput, 'SesionNueva;');
    expect(screen.getByText('SesionNueva')).toBeInTheDocument();

    // Click × on persisted tag chip
    await user.click(screen.getByRole('button', { name: es.tasks.removeTagAria('Persistida') }));
    expect(screen.getByText(es.tasks.removeTagDescription)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: es.tasks.removeOnlyFromTask }));

    // Unsaved title and session tag are preserved
    expect(titleInput).toHaveValue('Título editado sin guardar');
    expect(screen.getByText('SesionNueva')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: es.tasks.removeTagAria('Persistida') })).not.toBeInTheDocument();

    // Persisted removal already happened in storage
    const taskInRepo = await taskRepository.getById(task.id);
    expect(taskInRepo?.tagIds).toEqual([]);
  });

  it('auto-captures valid pending tag text on submit and blocks submit when > 30 chars (REQ-TG-06b)', async () => {
    const user = userEvent.setup();
    render(<TaskFormModal show={true} onClose={() => {}} />);

    await user.type(screen.getByLabelText(es.tasks.titleLabel), 'Tarea con etiqueta pendiente');
    const tagInput = screen.getByPlaceholderText(es.tasks.tagsPlaceholder);

    // > 30 chars blocks submission
    const overLimit = 'z'.repeat(31);
    await user.type(tagInput, overLimit);
    await user.click(screen.getByRole('button', { name: es.common.save }));

    expect(
      screen.getByText(es.validation.maxLength('El nombre de la etiqueta', 30)),
    ).toBeInTheDocument();
    expect(useTasksStore.getState().tasks).toHaveLength(0);

    // Valid pending text auto-captures on submit
    await user.clear(tagInput);
    await user.type(tagInput, 'AutoCapturada');
    await user.click(screen.getByRole('button', { name: es.common.save }));

    const createdTasks = useTasksStore.getState().tasks;
    expect(createdTasks).toHaveLength(1);
    expect(createdTasks[0].tagIds).toHaveLength(1);
    const createdTag = await tagRepository.getById(createdTasks[0].tagIds![0]);
    expect(createdTag?.name).toBe('AutoCapturada');
  });

  it('resolves secondary group tags and suggestions accurately when editing from GroupsGridView (AC-TG-11)', async () => {
    const user = userEvent.setup();
    await tagRepository.ensureTag(SEED_PERSONAL_GROUP.id, 'SoloPersonal');
    await tagRepository.ensureTag('grp-work', 'Sprint');
    await useTasksStore.getState().createTask({
      title: 'Tarea de Trabajo',
      tagNames: ['Backend'],
      groupId: 'grp-work',
    });

    render(<GroupsGridView />);
    const workTaskTitle = await screen.findByText('Tarea de Trabajo');
    const workCard = workTaskTitle.closest('.card') as HTMLElement;

    await user.click(within(workCard).getByRole('button', { name: es.tasks.actionMenuAria }));
    await user.click(within(workCard).getByRole('button', { name: es.tasks.actionEdit }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Backend')).toBeInTheDocument();

    const tagInput = within(dialog).getByPlaceholderText(es.tasks.tagsPlaceholder);
    await user.type(tagInput, 'Spr');
    expect(within(dialog).getByRole('button', { name: 'Sprint' })).toBeInTheDocument();

    await user.clear(tagInput);
    await user.type(tagInput, 'SoloPer');
    expect(within(dialog).queryByRole('button', { name: 'SoloPersonal' })).not.toBeInTheDocument();
  });
});
