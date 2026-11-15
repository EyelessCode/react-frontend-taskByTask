import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  GroupCard,
  GroupsFilterToolbar,
  GroupFormModal,
  GroupDeleteConfirmModal,
} from '@/features/groups/components';
import type { Group, Task } from '@/shared/schemas';
import { es } from '@/shared/i18n';

describe('Group Presentation Components (integration/features/groups)', () => {
  const personalGroup: Group = {
    id: 'group-personal',
    name: 'Personal',
    creatorId: 'local-user',
    isPersonal: true,
    type: 'individual',
    members: [
      {
        userId: 'local-user',
        role: 'creator',
        joinedAt: '2026-11-01T00:00:00.000Z',
      },
    ],
    createdAt: '2026-11-01T00:00:00.000Z',
  };

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
        joinedAt: '2026-11-02T00:00:00.000Z',
      },
    ],
    createdAt: '2026-11-02T00:00:00.000Z',
  };

  const sampleTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Completar informe mensual',
      groupId: 'grp-work',
      completed: false,
      createdAt: '2026-11-02T10:00:00.000Z',
      tagIds: [],
    },
    {
      id: 'task-2',
      title: 'Revisión con el equipo',
      groupId: 'grp-work',
      completed: true,
      createdAt: '2026-11-02T11:00:00.000Z',
      tagIds: [],
    },
  ];

  describe('GroupCard (REQ-GRP-11, REQ-GRP-12, REQ-GRP-13, REQ-GRP-14, REQ-GRP-15, REQ-GRP-22)', () => {
    it('should render group title, Personal badge for personal group, and task count badge', () => {
      render(
        <GroupCard
          group={personalGroup}
          tasks={[]}
        />,
      );

      expect(screen.getByRole('heading', { level: 2, name: 'Personal' })).toBeInTheDocument();
      expect(screen.getAllByText(es.groups.personalBadge)).toHaveLength(2); // Heading + Badge
      expect(screen.getByText(es.groups.taskCount(0))).toBeInTheDocument();
    });

    it('should NOT render Personal badge for non-personal groups', () => {
      render(
        <GroupCard
          group={workGroup}
          tasks={sampleTasks}
        />,
      );

      expect(screen.getByText('Trabajo')).toBeInTheDocument();
      expect(screen.queryByText(es.groups.personalBadge)).not.toBeInTheDocument();
      expect(screen.getByText(es.groups.taskCount(2))).toBeInTheDocument();
    });

    it('should render empty state message when task list is empty (REQ-GRP-22)', () => {
      render(
        <GroupCard
          group={workGroup}
          tasks={[]}
        />,
      );

      expect(screen.getByText(es.groups.emptyGroupTasks)).toBeInTheDocument();
    });

    it('should render tasks inside .task-list container', () => {
      const { container } = render(
        <GroupCard
          group={workGroup}
          tasks={sampleTasks}
        />,
      );

      const taskList = container.querySelector('.task-list');
      expect(taskList).toBeInTheDocument();
      expect(screen.getByText('Completar informe mensual')).toBeInTheDocument();
      expect(screen.getByText('Revisión con el equipo')).toBeInTheDocument();
    });

    it('should provide context menu with "Renombrar" and omit "Eliminar" for Personal group (REQ-GRP-11, AC-GRP-04)', async () => {
      const user = userEvent.setup();
      const onRename = vi.fn();
      const onDelete = vi.fn();

      render(
        <GroupCard
          group={personalGroup}
          tasks={[]}
          onRenameGroup={onRename}
          onDeleteGroup={onDelete}
        />,
      );

      const menuToggle = screen.getByRole('button', { name: es.groups.groupMenuAria });
      await user.click(menuToggle);

      expect(screen.getByText(es.groups.actionRename)).toBeInTheDocument();
      expect(screen.queryByText(es.groups.actionDelete)).not.toBeInTheDocument();

      // Ensure no sharing or member options exist (REQ-GRP-06)
      expect(screen.queryByText(/compartir/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/miembros/i)).not.toBeInTheDocument();

      await user.click(screen.getByText(es.groups.actionRename));
      expect(onRename).toHaveBeenCalledWith(personalGroup);
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('should provide context menu with both "Renombrar" and "Eliminar" for individual groups', async () => {
      const user = userEvent.setup();
      const onRename = vi.fn();
      const onDelete = vi.fn();

      render(
        <GroupCard
          group={workGroup}
          tasks={sampleTasks}
          onRenameGroup={onRename}
          onDeleteGroup={onDelete}
        />,
      );

      const menuToggle = screen.getByRole('button', { name: es.groups.groupMenuAria });
      await user.click(menuToggle);

      expect(screen.getByText(es.groups.actionRename)).toBeInTheDocument();
      expect(screen.getByText(es.groups.actionDelete)).toBeInTheDocument();

      await user.click(screen.getByText(es.groups.actionDelete));
      expect(onDelete).toHaveBeenCalledWith(workGroup);
    });

    it('should trigger onAddTask with groupId when "+ Nueva tarea" is clicked (REQ-GRP-15)', async () => {
      const user = userEvent.setup();
      const onAddTask = vi.fn();

      render(
        <GroupCard
          group={workGroup}
          tasks={sampleTasks}
          onAddTask={onAddTask}
        />,
      );

      const addTaskBtn = screen.getByRole('button', { name: new RegExp(es.groups.addTaskToGroup, 'i') });
      await user.click(addTaskBtn);

      expect(onAddTask).toHaveBeenCalledWith(workGroup.id);
    });
  });

  describe('GroupsFilterToolbar (REQ-GRP-17, REQ-GRP-18, REQ-GRP-19, REQ-GRP-20)', () => {
    it('should render search input, status tabs with counts, group pills, and action buttons', async () => {
      const user = userEvent.setup();
      const onSearchChange = vi.fn();
      const onFilterChange = vi.fn();
      const onToggleGroup = vi.fn();
      const onSelectAllGroups = vi.fn();
      const onCreateGroup = vi.fn();
      const onRefresh = vi.fn();

      render(
        <GroupsFilterToolbar
          groups={[personalGroup, workGroup]}
          selectedGroupIds={[]}
          searchQuery=""
          activeFilter="pendientes"
          counts={{ pending: 5, completed: 3, all: 8 }}
          onSearchChange={onSearchChange}
          onFilterChange={onFilterChange}
          onToggleGroup={onToggleGroup}
          onSelectAllGroups={onSelectAllGroups}
          onCreateGroup={onCreateGroup}
          onRefresh={onRefresh}
        />,
      );

      // Search input
      const searchInput = screen.getByPlaceholderText(es.groups.searchPlaceholder);
      expect(searchInput).toBeInTheDocument();
      await user.type(searchInput, 'tarea');
      expect(onSearchChange).toHaveBeenCalled();

      // Status tabs
      const pendingTab = screen.getByText(/Pendientes \(5\)/i);
      const completedTab = screen.getByText(/Completadas \(3\)/i);
      const allTab = screen.getByText(/Todas \(8\)/i);

      expect(pendingTab).toBeInTheDocument();
      expect(completedTab).toBeInTheDocument();
      expect(allTab).toBeInTheDocument();

      await user.click(completedTab);
      expect(onFilterChange).toHaveBeenCalledWith('completadas');

      // Group pills
      const allGroupsPill = screen.getByText(es.groups.allGroupsOption);
      const workPill = screen.getByText('Trabajo');
      expect(allGroupsPill).toBeInTheDocument();
      expect(workPill).toBeInTheDocument();

      await user.click(workPill);
      expect(onToggleGroup).toHaveBeenCalledWith(workGroup.id);

      // Action buttons
      const newGroupBtn = screen.getByText(new RegExp(es.groups.createGroupButton, 'i'));
      const refreshBtn = screen.getByText(new RegExp(es.groups.refreshButton, 'i'));

      await user.click(newGroupBtn);
      expect(onCreateGroup).toHaveBeenCalledTimes(1);

      await user.click(refreshBtn);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('GroupFormModal (REQ-GRP-01, REQ-GRP-04, REQ-GRP-07)', () => {
    it('should render create modal and trigger form validation for short names', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <GroupFormModal
          show={true}
          onClose={onClose}
        />,
      );

      expect(screen.getByText(es.groups.createModalTitle)).toBeInTheDocument();
      const input = screen.getByLabelText(es.groups.nameLabel);
      expect(input).toBeInTheDocument();

      // Type 2 characters (< 3 minimum)
      await user.type(input, 'ab');
      const submitBtn = screen.getByRole('button', { name: es.common.confirm });
      await user.click(submitBtn);

      expect(await screen.findByText(/al menos 3 caracteres/i)).toBeInTheDocument();
    });

    it('should pre-populate group name in rename mode', () => {
      render(
        <GroupFormModal
          show={true}
          group={workGroup}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText(es.groups.renameModalTitle)).toBeInTheDocument();
      const input = screen.getByLabelText(es.groups.nameLabel) as HTMLInputElement;
      expect(input.value).toBe('Trabajo');
    });
  });

  describe('GroupDeleteConfirmModal (REQ-GRP-09, REQ-GRP-10, UI-06)', () => {
    it('should render warning message and invoke onConfirm upon clicking delete', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <GroupDeleteConfirmModal
          show={true}
          group={workGroup}
          onClose={onClose}
          onConfirm={onConfirm}
        />,
      );

      expect(screen.getByText(es.groups.deleteModalTitle)).toBeInTheDocument();
      expect(screen.getByText(es.groups.deleteModalWarning('Trabajo'))).toBeInTheDocument();

      const deleteBtn = screen.getByRole('button', { name: es.common.delete });
      await user.click(deleteBtn);

      expect(onConfirm).toHaveBeenCalledWith(workGroup);
    });

    it('should invoke onClose upon clicking cancel', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <GroupDeleteConfirmModal
          show={true}
          group={workGroup}
          onClose={onClose}
        />,
      );

      const cancelBtn = screen.getByRole('button', { name: es.common.cancel });
      await user.click(cancelBtn);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
