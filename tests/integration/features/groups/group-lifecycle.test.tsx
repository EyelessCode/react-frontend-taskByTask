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
  configureGroupsStore,
  resetGroupsStore,
} from '@/features/groups/store/groups-store';
import {
  configureTasksStore,
  resetTasksStore,
} from '@/features/tasks/store/tasks-store';
import { GroupsGridView } from '@/features/groups/components/GroupsGridView';
import { es } from '@/shared/i18n';

describe('Group Full Lifecycle Integration (integration/features/groups/group-lifecycle)', () => {
  let mockStorage: MockStorage;
  let adapter: LocalStorageAdapter;
  let taskRepository: LocalStorageTaskRepository;
  let groupRepository: LocalStorageGroupRepository;
  let tagRepository: LocalStorageTagRepository;

  beforeEach(() => {
    mockStorage = new MockStorage();
    adapter = new LocalStorageAdapter(mockStorage);
    taskRepository = new LocalStorageTaskRepository(adapter);
    groupRepository = new LocalStorageGroupRepository(adapter);
    tagRepository = new LocalStorageTagRepository(adapter);

    configureGroupsStore({
      groupRepository,
      taskRepository,
      tagRepository,
      getActiveUserId: () => Promise.resolve('local-user'),
    });
    resetGroupsStore();

    configureTasksStore({
      taskRepository,
      groupRepository,
      tagRepository,
      getActiveUserId: () => Promise.resolve('local-user'),
    });
    resetTasksStore();
  });

  it('should run full lifecycle: create group, rename group, add task, and cascade delete group', async () => {
    const user = userEvent.setup();
    render(<GroupsGridView />);

    // 1. Initial state: Personal group loaded
    expect(await screen.findByRole('heading', { level: 2, name: 'Personal' })).toBeInTheDocument();

    // Verify Personal group cannot be deleted (REQ-GRP-11)
    const personalCard = screen.getByRole('heading', { level: 2, name: 'Personal' }).closest('.group-card') as HTMLElement;
    const personalMenuBtn = within(personalCard).getByRole('button', { name: es.groups.groupMenuAria });
    await user.click(personalMenuBtn);
    expect(within(personalCard).getByText(es.groups.actionRename)).toBeInTheDocument();
    expect(within(personalCard).queryByText(es.groups.actionDelete)).not.toBeInTheDocument();
    // Close personal dropdown
    await user.click(personalMenuBtn);

    // 2. Create new group via "+ Nuevo grupo" button (REQ-GRP-01, REQ-GRP-05)
    const newGroupBtn = screen.getByText(new RegExp(es.groups.createGroupButton, 'i'));
    await user.click(newGroupBtn);

    expect(await screen.findByText(es.groups.createModalTitle)).toBeInTheDocument();
    const nameInput = screen.getByLabelText(es.groups.nameLabel);
    await user.type(nameInput, 'Proyectos 2026');

    const confirmCreateBtn = screen.getByRole('button', { name: es.common.confirm });
    await user.click(confirmCreateBtn);

    // Verify new group card appears in the grid
    expect(await screen.findByRole('heading', { level: 2, name: 'Proyectos 2026' })).toBeInTheDocument();

    // 3. Rename the newly created group (REQ-GRP-07, REQ-GRP-08)
    const projectCard = screen.getByRole('heading', { level: 2, name: 'Proyectos 2026' }).closest('.group-card') as HTMLElement;
    const projectMenuBtn = within(projectCard).getByRole('button', { name: es.groups.groupMenuAria });
    await user.click(projectMenuBtn);

    const renameItem = within(projectCard).getByText(es.groups.actionRename);
    await user.click(renameItem);

    expect(await screen.findByText(es.groups.renameModalTitle)).toBeInTheDocument();
    const renameInput = screen.getByLabelText(es.groups.nameLabel);
    await user.clear(renameInput);
    await user.type(renameInput, 'Proyectos Renovados');

    const confirmRenameBtn = screen.getByRole('button', { name: es.common.confirm });
    await user.click(confirmRenameBtn);

    // Verify renamed group header
    expect(await screen.findByRole('heading', { level: 2, name: 'Proyectos Renovados' })).toBeInTheDocument();

    // 4. Add task to the group via inline "+ Nueva tarea" button (REQ-GRP-15)
    const renamedCard = screen.getByRole('heading', { level: 2, name: 'Proyectos Renovados' }).closest('.group-card')!;
    const addTaskBtn = renamedCard.querySelector('button.btn-outline-primary') as HTMLElement;
    await user.click(addTaskBtn);

    expect(await screen.findByRole('heading', { name: es.tasks.createTitle })).toBeInTheDocument();
    const titleInput = screen.getByLabelText(es.tasks.titleLabel);
    await user.type(titleInput, 'Definir arquitectura');

    const saveTaskBtn = screen.getByRole('button', { name: es.common.save });
    await user.click(saveTaskBtn);

    // Verify task rendered inside group card
    expect(await screen.findByText('Definir arquitectura')).toBeInTheDocument();

    // 5. Delete group with cascade confirmation (REQ-GRP-09, REQ-GRP-10)
    const cardBeforeDelete = screen.getByRole('heading', { level: 2, name: 'Proyectos Renovados' }).closest('.group-card') as HTMLElement;
    const deleteMenuBtn = within(cardBeforeDelete).getByRole('button', { name: es.groups.groupMenuAria });
    await user.click(deleteMenuBtn);

    const deleteItem = within(cardBeforeDelete).getByText(es.groups.actionDelete);
    await user.click(deleteItem);

    expect(await screen.findByText(es.groups.deleteModalTitle)).toBeInTheDocument();
    expect(screen.getByText(es.groups.deleteModalWarning('Proyectos Renovados'))).toBeInTheDocument();

    const modal = screen.getByRole('dialog');
    const confirmDeleteBtn = within(modal).getByRole('button', { name: es.common.delete });
    await user.click(confirmDeleteBtn);

    // Verify group and task permanently removed
    expect(screen.queryByRole('heading', { level: 2, name: 'Proyectos Renovados' })).not.toBeInTheDocument();
    expect(screen.queryByText('Definir arquitectura')).not.toBeInTheDocument();

    // Storage cascade verification
    const storedGroups = await groupRepository.getAll();
    expect(storedGroups.some((g) => g.name === 'Proyectos Renovados')).toBe(false);
    const storedTasks = await taskRepository.getAll();
    expect(storedTasks.some((t) => t.title === 'Definir arquitectura')).toBe(false);
  }, 15000);
});
