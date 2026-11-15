import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
import { SEED_PERSONAL_GROUP, type Group, type Task } from '@/shared/schemas';
import { es } from '@/shared/i18n';

describe('GroupsGridView Integration (integration/features/groups/groups-grid-view)', () => {
  let mockStorage: MockStorage;
  let adapter: LocalStorageAdapter;
  let taskRepository: LocalStorageTaskRepository;
  let groupRepository: LocalStorageGroupRepository;
  let tagRepository: LocalStorageTagRepository;

  const studyGroup: Group = {
    id: 'grp-study',
    name: 'Estudio',
    creatorId: 'local-user',
    isPersonal: false,
    type: 'individual',
    members: [
      {
        userId: 'local-user',
        role: 'creator',
        joinedAt: '2026-11-02T10:00:00.000Z',
      },
    ],
    createdAt: '2026-11-02T10:00:00.000Z',
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
        joinedAt: '2026-11-03T10:00:00.000Z',
      },
    ],
    createdAt: '2026-11-03T10:00:00.000Z',
  };

  const taskPersonal: Task = {
    id: 'task-p',
    title: 'Comprar víveres',
    groupId: SEED_PERSONAL_GROUP.id,
    completed: false,
    createdAt: '2026-11-01T12:00:00.000Z',
    tagIds: [],
  };

  const taskStudy: Task = {
    id: 'task-s',
    title: 'Estudiar para el examen de cálculo',
    groupId: studyGroup.id,
    completed: false,
    createdAt: '2026-11-02T12:00:00.000Z',
    tagIds: [],
  };

  const taskWork: Task = {
    id: 'task-w',
    title: 'Enviar reporte financiero',
    groupId: workGroup.id,
    completed: true,
    createdAt: '2026-11-03T12:00:00.000Z',
    tagIds: [],
  };

  beforeEach(async () => {
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

    await groupRepository.ensureSeedGroup();
    await groupRepository.save(studyGroup);
    await groupRepository.save(workGroup);

    await taskRepository.save(taskPersonal);
    await taskRepository.save(taskStudy);
    await taskRepository.save(taskWork);
  });

  it('should render header with regression selectors and sorted group cards', async () => {
    render(<GroupsGridView />);

    // Header title and tagline
    expect(await screen.findByRole('heading', { level: 1, name: 'Task by Task' })).toBeInTheDocument();
    expect(screen.getByText(es.app.tagline)).toBeInTheDocument();

    // Active group select and header span
    const activeGroupSelect = screen.getByLabelText('Cambiar grupo activo');
    expect(activeGroupSelect).toBeInTheDocument();
    expect(screen.getByText('Personal', { selector: 'header span.fw-semibold' })).toBeInTheDocument();

    // Group cards rendered in order (Personal first, then oldest)
    const cards = screen.getAllByRole('heading', { level: 2 });
    const cardNames = cards.map((c) => c.textContent);
    expect(cardNames).toEqual(['Personal', 'Estudio', 'Trabajo']);
  });

  it('should filter tasks by title substring and show alert banner when 0 match (REQ-GRP-18, REQ-GRP-23)', async () => {
    const user = userEvent.setup();
    render(<GroupsGridView />);

    // Initial load: 3 groups visible
    expect(await screen.findByRole('heading', { level: 2, name: 'Estudio' })).toBeInTheDocument();
    expect(screen.getByText('Estudiar para el examen de cálculo')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(es.groups.searchPlaceholder);

    // Type query that matches only the study task
    await user.type(searchInput, 'cálculo');
    expect(screen.getByText('Estudiar para el examen de cálculo')).toBeInTheDocument();
    expect(screen.queryByText('Comprar víveres')).not.toBeInTheDocument();
    expect(screen.queryByText(es.groups.emptySearchGlobal)).not.toBeInTheDocument();

    // Type query that matches zero tasks
    await user.clear(searchInput);
    await user.type(searchInput, 'inexistente');

    // Prominent alert banner rendered (REQ-GRP-23)
    expect(await screen.findByText(es.groups.emptySearchGlobal)).toBeInTheDocument();
    // Groups grid cards remain visible
    expect(screen.getByRole('heading', { level: 2, name: 'Personal' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Estudio' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Trabajo' })).toBeInTheDocument();
  });

  it('should filter visible group cards using multi-group selector pills (REQ-GRP-19, REQ-GRP-20)', async () => {
    const user = userEvent.setup();
    render(<GroupsGridView />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Trabajo' })).toBeInTheDocument();

    // Click 'Trabajo' pill button
    const trabajoPill = screen.getByRole('button', { name: 'Trabajo' });
    await user.click(trabajoPill);

    // Only 'Trabajo' group card is visible
    expect(screen.getByRole('heading', { level: 2, name: 'Trabajo' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Personal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Estudio' })).not.toBeInTheDocument();

    // Click 'Todos los grupos' pill
    const allGroupsPill = screen.getByRole('button', { name: es.groups.allGroupsOption });
    await user.click(allGroupsPill);

    // All group cards visible again
    expect(screen.getByRole('heading', { level: 2, name: 'Personal' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Estudio' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Trabajo' })).toBeInTheDocument();
  });

  it('should switch status tabs and partition tasks accordingly (REQ-GRP-17)', async () => {
    const user = userEvent.setup();
    render(<GroupsGridView />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Estudio' })).toBeInTheDocument();

    // Default 'Pendientes': taskPersonal and taskStudy are pending, taskWork is completed
    expect(screen.getByText('Comprar víveres')).toBeInTheDocument();
    expect(screen.getByText('Estudiar para el examen de cálculo')).toBeInTheDocument();
    expect(screen.queryByText('Enviar reporte financiero')).not.toBeInTheDocument();

    // Switch to 'Completadas'
    const completedTab = screen.getByRole('tab', { name: /Completadas/i });
    await user.click(completedTab);

    expect(screen.queryByText('Comprar víveres')).not.toBeInTheDocument();
    expect(screen.queryByText('Estudiar para el examen de cálculo')).not.toBeInTheDocument();
    expect(screen.getByText('Enviar reporte financiero')).toBeInTheDocument();

    // Switch to 'Todas'
    const allTab = screen.getByRole('tab', { name: /Todas/i });
    await user.click(allTab);

    expect(screen.getByText('Comprar víveres')).toBeInTheDocument();
    expect(screen.getByText('Estudiar para el examen de cálculo')).toBeInTheDocument();
    expect(screen.getByText('Enviar reporte financiero')).toBeInTheDocument();
  });

  it('should refresh state without page reload upon clicking refresh button (REQ-GRP-16)', async () => {
    const user = userEvent.setup();
    render(<GroupsGridView />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Personal' })).toBeInTheDocument();

    // External task insert
    await taskRepository.save({
      id: 'task-external',
      title: 'Tarea agregada externamente',
      groupId: SEED_PERSONAL_GROUP.id,
      completed: false,
      createdAt: '2026-11-04T12:00:00.000Z',
      tagIds: [],
    });

    const refreshBtn = screen.getByRole('button', { name: new RegExp(es.groups.refreshButton, 'i') });
    await user.click(refreshBtn);

    expect(await screen.findByText('Tarea agregada externamente')).toBeInTheDocument();
  });
});
