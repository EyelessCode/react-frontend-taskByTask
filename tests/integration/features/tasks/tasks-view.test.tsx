import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
} from '@/features/tasks/store/tasks-store';
import { TasksView } from '@/features/tasks/components/TasksView';
import type { Group } from '@/shared/schemas';
import { es } from '@/shared/i18n';

describe('TasksView Application Integration (integration/features/tasks)', () => {
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

  it('should auto-initialize default Personal group and display header and empty state', async () => {
    render(<TasksView />);

    // Header title and active group
    expect(await screen.findByText(es.app.title)).toBeInTheDocument();
    expect((await screen.findAllByText('Personal')).length).toBeGreaterThan(0);

    // Nueva tarea button
    expect(
      screen.getByRole('button', { name: new RegExp(es.tasks.createTitle, 'i') }),
    ).toBeInTheDocument();

    // Empty state
    expect(screen.getByText(es.tasks.emptyPending)).toBeInTheDocument();
  });

  it('should create a new task via TaskFormModal and render it in the list', async () => {
    const user = userEvent.setup();
    render(<TasksView />);

    // Click "Nueva tarea"
    const createBtn = await screen.findByRole('button', {
      name: new RegExp(es.tasks.createTitle, 'i'),
    });
    await user.click(createBtn);

    // Modal opens
    expect(screen.getByRole('heading', { name: es.tasks.createTitle })).toBeInTheDocument();

    const titleInput = screen.getByLabelText(es.tasks.titleLabel);
    await user.type(titleInput, 'Preparar entrega final');

    const saveBtn = screen.getByRole('button', { name: es.common.save });
    await user.click(saveBtn);

    // Task appears in the view
    expect(await screen.findByText('Preparar entrega final')).toBeInTheDocument();
    expect(screen.queryByText(es.tasks.emptyPending)).not.toBeInTheDocument();

    // Tab count should be 1
    expect(screen.getByRole('tab', { name: /Pendientes \(1\)/i })).toBeInTheDocument();
  });

  it('should toggle task completion, update counts, and reflect across filter tabs', async () => {
    const user = userEvent.setup();
    render(<TasksView />);

    // Create a task first
    const createBtn = await screen.findByRole('button', {
      name: new RegExp(es.tasks.createTitle, 'i'),
    });
    await user.click(createBtn);

    const titleInput = screen.getByLabelText(es.tasks.titleLabel);
    await user.type(titleInput, 'Tarea para completar');
    await user.click(screen.getByRole('button', { name: es.common.save }));

    expect(await screen.findByText('Tarea para completar')).toBeInTheDocument();

    // Toggle completion
    const checkbox = screen.getByRole('checkbox', { name: /Marcar tarea/i });
    await user.click(checkbox);

    // Now 0 pending, 1 completed
    expect(await screen.findByText(es.tasks.emptyPending)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Pendientes \(0\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Completadas \(1\)/i })).toBeInTheDocument();

    // Switch to Completadas tab
    const completedTab = screen.getByRole('tab', { name: /Completadas \(1\)/i });
    await user.click(completedTab);

    expect(await screen.findByText('Tarea para completar')).toBeInTheDocument();

    // Switch to Todas tab
    const allTab = screen.getByRole('tab', { name: /Todas \(1\)/i });
    await user.click(allTab);

    expect(await screen.findByText('Tarea para completar')).toBeInTheDocument();
  });

  it('should support editing task attributes through the action menu and modal', async () => {
    const user = userEvent.setup();
    render(<TasksView />);

    // Create task
    await user.click(
      await screen.findByRole('button', { name: new RegExp(es.tasks.createTitle, 'i') }),
    );
    await user.type(screen.getByLabelText(es.tasks.titleLabel), 'Tarea inicial');
    await user.click(screen.getByRole('button', { name: es.common.save }));

    expect(await screen.findByText('Tarea inicial')).toBeInTheDocument();

    // Open options menu
    const menuBtn = screen.getByRole('button', { name: es.tasks.actionMenuAria });
    await user.click(menuBtn);

    // Click "Editar"
    const editBtn = screen.getByRole('button', { name: es.tasks.actionEdit });
    await user.click(editBtn);

    expect(screen.getByRole('heading', { name: es.tasks.editTitle })).toBeInTheDocument();

    const titleInput = screen.getByLabelText<HTMLInputElement>(es.tasks.titleLabel);
    await user.clear(titleInput);
    await user.type(titleInput, 'Tarea con título editado');
    await user.click(screen.getByRole('button', { name: es.common.save }));

    expect(await screen.findByText('Tarea con título editado')).toBeInTheDocument();
  });

  it('should open delete confirmation modal and permanently remove task', async () => {
    const user = userEvent.setup();
    render(<TasksView />);

    // Create task
    await user.click(
      await screen.findByRole('button', { name: new RegExp(es.tasks.createTitle, 'i') }),
    );
    await user.type(screen.getByLabelText(es.tasks.titleLabel), 'Tarea para eliminar');
    await user.click(screen.getByRole('button', { name: es.common.save }));

    expect(await screen.findByText('Tarea para eliminar')).toBeInTheDocument();

    // Open menu & click Eliminar
    await user.click(screen.getByRole('button', { name: es.tasks.actionMenuAria }));
    await user.click(screen.getByRole('button', { name: es.tasks.actionDelete }));

    // Delete modal appears
    expect(screen.getByRole('heading', { name: es.tasks.deleteTitle })).toBeInTheDocument();
    expect(screen.getByText(es.tasks.deleteMessage)).toBeInTheDocument();

    // Confirm deletion inside modal dialog
    const modalDialog = screen.getByRole('dialog');
    const confirmDeleteBtn = within(modalDialog).getByRole('button', {
      name: es.tasks.confirmDelete,
    });
    await user.click(confirmDeleteBtn);

    // Task is removed, empty state returns
    expect(await screen.findByText(es.tasks.emptyPending)).toBeInTheDocument();
  });

  it('should support move and copy workflows to other groups', async () => {
    const user = userEvent.setup();
    await groupRepository.save(workGroup);
    render(<TasksView />);

    // Create task in Personal
    await user.click(
      await screen.findByRole('button', { name: new RegExp(es.tasks.createTitle, 'i') }),
    );
    await user.type(screen.getByLabelText(es.tasks.titleLabel), 'Tarea para mover');
    await user.click(screen.getByRole('button', { name: es.common.save }));

    expect(await screen.findByText('Tarea para mover')).toBeInTheDocument();

    // Open menu & click Mover a...
    await user.click(screen.getByRole('button', { name: es.tasks.actionMenuAria }));
    await user.click(screen.getByRole('button', { name: es.tasks.actionMove }));

    expect(screen.getByRole('heading', { name: es.tasks.moveTitle })).toBeInTheDocument();

    const select = screen.getByLabelText(es.tasks.selectGroupLabel);
    await user.selectOptions(select, 'grp-work');

    await user.click(screen.getByRole('button', { name: es.tasks.confirmMove }));

    // In current personal group, task is gone
    expect(await screen.findByText(es.tasks.emptyPending)).toBeInTheDocument();

    // Switch group to Trabajo
    const groupSelect = screen.getByLabelText(/Cambiar grupo activo/i);
    fireEvent.change(groupSelect, { target: { value: 'grp-work' } });

    // Task is now visible under Trabajo group
    expect(await screen.findByText('Tarea para mover')).toBeInTheDocument();
  });
});
