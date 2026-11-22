import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  GroupsApiRepository,
  TagsApiRepository,
  TasksApiRepository,
} from '@/data/contracts';
import { GroupCard } from '@/features/groups/components/GroupCard';
import { GroupsFilterToolbar } from '@/features/groups/components/GroupsFilterToolbar';
import { GroupsGridView } from '@/features/groups/components/GroupsGridView';
import { GroupFormModal } from '@/features/groups/components/GroupFormModal';
import {
  configureGroupsStore,
  resetGroupsStore,
  useGroupsStore,
} from '@/features/groups/store';
import { TaskCard } from '@/features/tasks/components/TaskCard';
import { TaskFormModal } from '@/features/tasks/components/TaskFormModal';
import { TaskMoveCopyModal } from '@/features/tasks/components/TaskMoveCopyModal';
import {
  configureTasksStore,
  resetTasksStore,
  useTasksStore,
} from '@/features/tasks/store';
import { resetAuthStore, useAuthStore } from '@/features/auth/store';
import { resetNotificationsStore } from '@/features/notifications/store';
import { ApiProblemError } from '@/shared/errors';
import { es } from '@/shared/i18n';
import type { Group, Task } from '@/shared/schemas';

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: overrides.id ?? '1',
    name: overrides.name ?? 'Personal',
    creatorId: overrides.creatorId ?? '1',
    isPersonal: overrides.isPersonal ?? true,
    type: 'individual',
    members: overrides.members ?? [
      { userId: '1', role: 'creator', joinedAt: '2026-11-20T09:00:00Z' },
    ],
    createdAt: overrides.createdAt ?? '2026-11-20T09:00:00Z',
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? '100',
    title: overrides.title ?? 'Tarea de prueba',
    description: overrides.description ?? null,
    groupId: overrides.groupId ?? '1',
    tagIds: overrides.tagIds ?? [],
    completed: overrides.completed ?? false,
    createdAt: overrides.createdAt ?? '2026-11-20T10:00:00Z',
    completedAt: overrides.completedAt ?? null,
    dueDate: overrides.dueDate ?? null,
    dueTime: overrides.dueTime ?? null,
    assigneeId: overrides.assigneeId ?? null,
    overdue: overrides.overdue,
  };
}

function createApiMocks() {
  const groupsApi: GroupsApiRepository = {
    listGroups: vi.fn<GroupsApiRepository['listGroups']>(),
    getGroup: vi.fn<GroupsApiRepository['getGroup']>(),
    createGroup: vi.fn<GroupsApiRepository['createGroup']>(),
    renameGroup: vi.fn<GroupsApiRepository['renameGroup']>(),
    deleteGroup: vi.fn<GroupsApiRepository['deleteGroup']>(),
  };

  const tasksApi: TasksApiRepository = {
    listTasks: vi.fn<TasksApiRepository['listTasks']>(),
    listGroupTasks: vi.fn<TasksApiRepository['listGroupTasks']>(),
    getTask: vi.fn<TasksApiRepository['getTask']>(),
    createTask: vi.fn<TasksApiRepository['createTask']>(),
    updateTask: vi.fn<TasksApiRepository['updateTask']>(),
    deleteTask: vi.fn<TasksApiRepository['deleteTask']>(),
    updateCompletion: vi.fn<TasksApiRepository['updateCompletion']>(),
    moveTask: vi.fn<TasksApiRepository['moveTask']>(),
    copyTask: vi.fn<TasksApiRepository['copyTask']>(),
    detachTagFromTask: vi.fn<TasksApiRepository['detachTagFromTask']>(),
  };

  const tagsApi: TagsApiRepository = {
    listGroupTags: vi.fn<TagsApiRepository['listGroupTags']>(),
    createOrReuseTag: vi.fn<TagsApiRepository['createOrReuseTag']>(),
    deleteGroupTag: vi.fn<TagsApiRepository['deleteGroupTag']>(),
  };

  return { groupsApi, tasksApi, tagsApi };
}

describe('Workspace Pagination & API UI Integration (T8)', () => {
  beforeEach(() => {
    resetAuthStore();
    resetGroupsStore();
    resetTasksStore();
    resetNotificationsStore();
  });

  afterEach(() => {
    configureGroupsStore({});
    configureTasksStore({});
    resetAuthStore();
    resetGroupsStore();
    resetTasksStore();
    resetNotificationsStore();
  });

  describe('TaskCard authoritative server overdue & completed strikethrough invariant', () => {
    it('uses task.overdue when incomplete and boolean is provided, ignoring local clock mismatch', () => {
      const now = new Date('2026-11-15T10:00:00.000Z');
      const serverOverdueTask = makeTask({
        id: 't-1',
        title: 'Servidor dice vencida',
        dueDate: '2026-12-20',
        completed: false,
        overdue: true,
      });

      const { container, rerender } = render(
        <TaskCard task={serverOverdueTask} now={now} timeZone="UTC" />,
      );

      expect(screen.getByText(es.tasks.badgeOverdue)).toBeInTheDocument();
      expect(container.querySelector('.card')?.classList.contains('border-danger')).toBe(true);
      expect(screen.getByText('Servidor dice vencida').classList.contains('text-danger')).toBe(
        true,
      );

      const serverNotOverdueTask = makeTask({
        id: 't-2',
        title: 'Servidor dice vigente',
        dueDate: '2026-11-01',
        completed: false,
        overdue: false,
      });

      rerender(<TaskCard task={serverNotOverdueTask} now={now} timeZone="UTC" />);

      expect(screen.queryByText(es.tasks.badgeOverdue)).not.toBeInTheDocument();
      expect(container.querySelector('.card')?.classList.contains('border-danger')).toBe(false);
    });

    it('renders completed task with strikethrough only even if task.overdue is true', () => {
      const completedWithOverdueFlag = makeTask({
        id: 't-3',
        title: 'Completada pero tenía overdue=true',
        completed: true,
        overdue: true,
      });

      const { container } = render(<TaskCard task={completedWithOverdueFlag} />);

      const title = screen.getByText('Completada pero tenía overdue=true');
      expect(title.classList.contains('text-decoration-line-through')).toBe(true);
      expect(title.classList.contains('text-danger')).toBe(false);
      expect(screen.queryByText(es.tasks.badgeOverdue)).not.toBeInTheDocument();
      expect(container.querySelector('.card')?.classList.contains('border-danger')).toBe(false);
    });
  });

  describe('GroupCard N+ badge and "Cargar más tareas"', () => {
    it('renders N+ tareas badge and "Cargar más tareas" button when hasMoreTasks is true', async () => {
      const user = userEvent.setup();
      const onLoadMoreTasks = vi.fn();
      const group = makeGroup({ id: '1', name: 'Personal' });
      const tasks = [makeTask({ id: '101' }), makeTask({ id: '102' })];

      const { rerender } = render(
        <GroupCard
          group={group}
          tasks={tasks}
          hasMoreTasks={true}
          isLoadingMoreTasks={false}
          onLoadMoreTasks={onLoadMoreTasks}
        />,
      );

      expect(screen.getByText(es.groups.taskCountAtLeast(2))).toBeInTheDocument();
      const loadMoreBtn = screen.getByRole('button', {
        name: new RegExp(es.tasks.loadMoreTasks, 'i'),
      });
      expect(loadMoreBtn).toBeEnabled();
      await user.click(loadMoreBtn);
      expect(onLoadMoreTasks).toHaveBeenCalledWith('1');

      rerender(
        <GroupCard
          group={group}
          tasks={tasks}
          hasMoreTasks={true}
          isLoadingMoreTasks={true}
          onLoadMoreTasks={onLoadMoreTasks}
        />,
      );
      const loadingBtn = screen.getByRole('button', {
        name: new RegExp(es.tasks.loadMoreTasks, 'i'),
      });
      expect(loadingBtn).toBeDisabled();
      expect(loadingBtn).toHaveTextContent(es.common.loadingMore);

      rerender(<GroupCard group={group} tasks={tasks} hasMoreTasks={false} />);
      expect(screen.getByText(es.groups.taskCount(2))).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: new RegExp(es.tasks.loadMoreTasks, 'i') }),
      ).not.toBeInTheDocument();
    });
  });

  describe('GroupsFilterToolbar active-tab-only counts & "Cargar más grupos"', () => {
    it('shows count only on active tab in API mode and renders "Cargar más grupos"', async () => {
      const user = userEvent.setup();
      const onLoadMoreGroups = vi.fn();
      const personal = makeGroup({ id: '1', name: 'Personal', isPersonal: true });

      const { rerender } = render(
        <GroupsFilterToolbar
          groups={[personal]}
          selectedGroupIds={[]}
          searchQuery=""
          activeFilter="pendientes"
          counts={{ pending: 20, completed: 0, all: 0 }}
          isApiMode={true}
          activeTabHasMore={true}
          groupsHasNext={true}
          isLoadingMoreGroups={false}
          onLoadMoreGroups={onLoadMoreGroups}
          onSearchChange={vi.fn()}
          onFilterChange={vi.fn()}
          onToggleGroup={vi.fn()}
          onSelectAllGroups={vi.fn()}
          onCreateGroup={vi.fn()}
          onRefresh={vi.fn()}
        />,
      );

      expect(screen.getByRole('tab', { name: 'Pendientes (20+)' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Completadas' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Todas' })).toBeInTheDocument();

      const loadMoreBtn = screen.getByRole('button', { name: es.groups.loadMoreGroups });
      await user.click(loadMoreBtn);
      expect(onLoadMoreGroups).toHaveBeenCalledTimes(1);

      // localStorage mode parity: all 3 tabs display counts, no Load More button
      rerender(
        <GroupsFilterToolbar
          groups={[personal]}
          selectedGroupIds={[]}
          searchQuery=""
          activeFilter="pendientes"
          counts={{ pending: 5, completed: 3, all: 8 }}
          isApiMode={false}
          onSearchChange={vi.fn()}
          onFilterChange={vi.fn()}
          onToggleGroup={vi.fn()}
          onSelectAllGroups={vi.fn()}
          onCreateGroup={vi.fn()}
          onRefresh={vi.fn()}
        />,
      );

      expect(screen.getByRole('tab', { name: 'Pendientes (5)' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Completadas (3)' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Todas (8)' })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: es.groups.loadMoreGroups }),
      ).not.toBeInTheDocument();
    });
  });

  describe('TaskMoveCopyModal paginated groups & copy mode', () => {
    it('suppresses noOtherGroups while groupsHasNext is true in API move mode and allows loading more', async () => {
      const user = userEvent.setup();
      const { groupsApi, tasksApi, tagsApi } = createApiMocks();
      const personal = makeGroup({ id: '1', name: 'Personal', isPersonal: true });
      const work = makeGroup({ id: '2', name: 'Trabajo', isPersonal: false });
      const task = makeTask({ id: '42', groupId: '1' });

      configureGroupsStore({
        mode: 'api',
        groupsApi,
        tasksApi,
        tagsApi,
        getActiveUserId: async () => '1',
      });
      configureTasksStore({
        mode: 'api',
        groupsApi,
        tasksApi,
        tagsApi,
        getActiveUserId: async () => '1',
      });

      useGroupsStore.setState({
        groups: [personal],
        groupsNextCursor: 'g-cur-1',
        groupsHasNext: true,
        isLoadingMoreGroups: false,
      });
      useTasksStore.setState({
        groups: [personal],
        activeGroupId: '1',
      });

      vi.mocked(groupsApi.listGroups).mockResolvedValueOnce({
        content: [work],
        nextCursor: null,
        hasNext: false,
        size: 1,
      });
      vi.mocked(tasksApi.listGroupTasks).mockResolvedValueOnce({
        content: [],
        nextCursor: null,
        hasNext: false,
        size: 0,
      });

      render(
        <TaskMoveCopyModal show={true} mode="move" task={task} onClose={vi.fn()} />,
      );

      expect(screen.queryByText(es.tasks.noOtherGroups)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: es.tasks.confirmMove })).toBeDisabled();

      const loadMoreBtn = screen.getByRole('button', { name: es.groups.loadMoreGroups });
      await user.click(loadMoreBtn);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Trabajo' })).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: es.tasks.confirmMove })).toBeEnabled();
    });

    it('includes source group in API copy mode, but excludes source group in localStorage copy mode', () => {
      const personal = makeGroup({ id: '1', name: 'Personal', isPersonal: true });
      const task = makeTask({ id: '42', groupId: '1' });

      configureTasksStore({ mode: 'api', getActiveUserId: async () => '1' });
      useGroupsStore.setState({ groups: [personal], groupsHasNext: false });
      useTasksStore.setState({ groups: [personal], activeGroupId: '1' });

      const { rerender } = render(
        <TaskMoveCopyModal show={true} mode="copy" task={task} onClose={vi.fn()} />,
      );

      expect(screen.getByRole('option', { name: 'Personal' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: es.tasks.confirmCopy })).toBeEnabled();

      // Switch to localStorage mode -> same-group copy is excluded
      configureTasksStore({ mode: 'localStorage', getActiveUserId: async () => '1' });
      rerender(<TaskMoveCopyModal show={true} mode="copy" task={task} onClose={vi.fn()} />);

      expect(screen.getByText(es.tasks.noOtherGroups)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: es.tasks.confirmCopy })).toBeDisabled();
    });
  });

  describe('GroupFormModal & TaskFormModal RFC 7807 error display', () => {
    it('displays GroupFormModal API field + general errors without closing modal', async () => {
      const user = userEvent.setup();
      const { groupsApi, tasksApi, tagsApi } = createApiMocks();
      const onClose = vi.fn();

      configureGroupsStore({
        mode: 'api',
        groupsApi,
        tasksApi,
        tagsApi,
        getActiveUserId: async () => '1',
      });

      vi.mocked(groupsApi.createGroup).mockRejectedValueOnce(
        new ApiProblemError('Error de validación', {
          status: 400,
          detail: 'No se pudo guardar el grupo.',
          invalidParams: [{ name: 'name', reason: 'Ya existe un grupo con ese nombre.' }],
        }),
      );

      render(<GroupFormModal show={true} onClose={onClose} />);

      const input = screen.getByLabelText(es.groups.nameLabel);
      await user.type(input, 'Trabajo');
      await user.click(screen.getByRole('button', { name: es.common.confirm }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('No se pudo guardar el grupo.');
      expect(screen.getByText('Ya existe un grupo con ese nombre.')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect((input as HTMLInputElement).value).toBe('Trabajo');
    });

    it('displays TaskFormModal API field + general errors without closing modal', async () => {
      const user = userEvent.setup();
      const { groupsApi, tasksApi, tagsApi } = createApiMocks();
      const onClose = vi.fn();
      const personal = makeGroup({ id: '1', name: 'Personal', isPersonal: true });

      configureTasksStore({
        mode: 'api',
        groupsApi,
        tasksApi,
        tagsApi,
        getActiveUserId: async () => '1',
      });
      useTasksStore.setState({ groups: [personal], activeGroupId: '1' });

      vi.mocked(tagsApi.listGroupTags).mockResolvedValue({
        content: [],
        nextCursor: null,
        hasNext: false,
        size: 0,
      });
      vi.mocked(tasksApi.createTask).mockRejectedValueOnce(
        new ApiProblemError('Error de validación', {
          status: 400,
          detail: 'Revisa los datos de la tarea.',
          invalidParams: [{ name: 'title', reason: 'El título contiene caracteres inválidos.' }],
        }),
      );

      render(<TaskFormModal show={true} defaultGroupId="1" onClose={onClose} />);

      const titleInput = screen.getByLabelText(es.tasks.titleLabel);
      await user.type(titleInput, 'Mi tarea');
      await user.click(screen.getByRole('button', { name: es.common.save }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Revisa los datos de la tarea.');
      expect(screen.getByText('El título contiene caracteres inválidos.')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect((titleInput as HTMLInputElement).value).toBe('Mi tarea');
    });
  });

  describe('GroupsGridView API pagination & global search banner', () => {
    it('wires per-group task pagination, grid-footer loadMoreGroups, and globalSearchHasMatches', async () => {
      const user = userEvent.setup();
      const { groupsApi, tasksApi, tagsApi } = createApiMocks();
      const personal = makeGroup({ id: '1', name: 'Personal', isPersonal: true });
      const work = makeGroup({
        id: '2',
        name: 'Trabajo',
        isPersonal: false,
        createdAt: '2026-11-20T09:05:00Z',
      });

      configureGroupsStore({
        mode: 'api',
        groupsApi,
        tasksApi,
        tagsApi,
        getActiveUserId: async () => '1',
        searchDebounceMs: 10,
      });
      configureTasksStore({
        mode: 'api',
        groupsApi,
        tasksApi,
        tagsApi,
        getActiveUserId: async () => '1',
      });
      useAuthStore.setState({ currentUser: null, isAuthenticated: false });

      vi.mocked(groupsApi.listGroups)
        .mockResolvedValueOnce({
          content: [personal],
          nextCursor: 'g-cur-1',
          hasNext: true,
          size: 1,
        })
        .mockResolvedValueOnce({
          content: [work],
          nextCursor: null,
          hasNext: false,
          size: 1,
        });

      vi.mocked(tasksApi.listGroupTasks).mockImplementation(async (groupId, params) => {
        if (params?.search === 'reporte') {
          return { content: [], nextCursor: null, hasNext: false, size: 0 };
        }
        if (groupId === '1' && !params?.cursor) {
          return {
            content: [{ task: makeTask({ id: '101', groupId: '1', title: 'Tarea 1' }), tags: [] }],
            nextCursor: 't-cur-1',
            hasNext: true,
            size: 1,
          };
        }
        if (groupId === '1' && params?.cursor === 't-cur-1') {
          return {
            content: [{ task: makeTask({ id: '102', groupId: '1', title: 'Tarea 2' }), tags: [] }],
            nextCursor: null,
            hasNext: false,
            size: 1,
          };
        }
        return {
          content: [{ task: makeTask({ id: '201', groupId: '2', title: 'Informe' }), tags: [] }],
          nextCursor: null,
          hasNext: false,
          size: 1,
        };
      });

      vi.mocked(tasksApi.listTasks).mockResolvedValueOnce({
        content: [{ task: makeTask({ id: '999', groupId: '2', title: 'Reporte' }), tags: [] }],
        nextCursor: null,
        hasNext: false,
        size: 1,
      });

      render(<GroupsGridView />);

      expect(await screen.findByText('Tarea 1')).toBeInTheDocument();
      expect(screen.getByText(es.groups.taskCountAtLeast(1))).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Pendientes (1+)' })).toBeInTheDocument();

      // Load more tasks inside Personal card
      await user.click(screen.getByRole('button', { name: new RegExp(es.tasks.loadMoreTasks, 'i') }));
      expect(await screen.findByText('Tarea 2')).toBeInTheDocument();
      expect(screen.getByText(es.groups.taskCount(2))).toBeInTheDocument();

      // Global search matching unloaded group suppresses emptySearchGlobal banner
      const searchInput = screen.getByPlaceholderText(es.groups.searchPlaceholder);
      await user.type(searchInput, 'reporte');
      await waitFor(() => {
        expect(tasksApi.listTasks).toHaveBeenCalled();
      });
      expect(screen.queryByText(es.groups.emptySearchGlobal)).not.toBeInTheDocument();

      // Clear search and click grid-footer "Cargar más grupos"
      await user.clear(searchInput);
      const loadMoreGroupButtons = await screen.findAllByRole('button', {
        name: es.groups.loadMoreGroups,
      });
      expect(loadMoreGroupButtons.length).toBeGreaterThanOrEqual(2);
      await user.click(loadMoreGroupButtons[loadMoreGroupButtons.length - 1]);

      expect(await screen.findByRole('heading', { level: 2, name: 'Trabajo' })).toBeInTheDocument();
    });
  });
});
