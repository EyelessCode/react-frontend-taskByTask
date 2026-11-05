import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  configureTasksStore,
  resetTasksStore,
  useTasksStore,
} from '@/features/tasks/store/tasks-store';
import { TaskMoveCopyModal } from '@/features/tasks/components/TaskMoveCopyModal';
import { TaskDeleteConfirmModal } from '@/features/tasks/components/TaskDeleteConfirmModal';
import { SEED_PERSONAL_GROUP, type Group, type Task } from '@/shared/schemas';
import { es } from '@/shared/i18n';

describe('TaskMoveCopyModal & TaskDeleteConfirmModal (integration/features/tasks)', () => {
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

  const studyGroup: Group = {
    id: 'grp-study',
    name: 'Universidad',
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

  const sharedGroup: Group = {
    id: 'grp-shared',
    name: 'Proyecto Compartido',
    creatorId: 'local-user',
    isPersonal: false,
    type: 'compartido',
    members: [
      {
        userId: 'local-user',
        role: 'creator',
        joinedAt: '2026-11-01T10:00:00.000Z',
      },
    ],
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const sampleTask: Task = {
    id: 'task-orig-1',
    title: 'Tarea para mover o copiar',
    description: 'Descripción original',
    groupId: SEED_PERSONAL_GROUP.id,
    completed: false,
    createdAt: '2026-11-01T10:00:00.000Z',
    dueDate: '2026-11-30',
    dueTime: '15:00',
    tagIds: [],
  };

  beforeEach(async () => {
    mockStorage = new MockStorage();
    adapter = new LocalStorageAdapter(mockStorage);
    taskRepository = new LocalStorageTaskRepository(adapter);
    groupRepository = new LocalStorageGroupRepository(adapter);
    tagRepository = new LocalStorageTagRepository(adapter);

    await taskRepository.save(sampleTask);

    configureTasksStore({
      taskRepository,
      groupRepository,
      tagRepository,
    });
    resetTasksStore();
  });

  describe('TaskMoveCopyModal (REQ-TK-19, REQ-TK-19b, REQ-TK-20..23)', () => {
    it('should display empty state message and disable confirm button when no other individual groups exist (REQ-TK-19b)', async () => {
      // Only personal group exists
      await useTasksStore.getState().init();

      render(
        <TaskMoveCopyModal
          show={true}
          mode="move"
          task={sampleTask}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText(es.tasks.noOtherGroups)).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: es.tasks.confirmMove });
      expect(confirmButton).toBeDisabled();
    });

    it('should list only other individual groups, excluding current group and shared groups (REQ-TK-19, REQ-TK-23)', async () => {
      await groupRepository.save(workGroup);
      await groupRepository.save(studyGroup);
      await groupRepository.save(sharedGroup);
      await useTasksStore.getState().init();

      render(
        <TaskMoveCopyModal
          show={true}
          mode="move"
          task={sampleTask}
          onClose={vi.fn()}
        />,
      );

      // Other individual groups should be listed
      expect(screen.getByRole('option', { name: 'Trabajo' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Universidad' })).toBeInTheDocument();

      // Current group (Personal) and shared groups should NOT be listed
      expect(screen.queryByRole('option', { name: 'Personal' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Proyecto Compartido' })).not.toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: es.tasks.confirmMove });
      expect(confirmButton).not.toBeDisabled();
    });

    it('should move task to destination group, preserving id and createdAt (REQ-TK-20)', async () => {
      const user = userEvent.setup();
      await groupRepository.save(workGroup);
      await useTasksStore.getState().init();

      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(
        <TaskMoveCopyModal
          show={true}
          mode="move"
          task={sampleTask}
          onClose={onClose}
          onSuccess={onSuccess}
        />,
      );

      expect(screen.getByText(es.tasks.moveTitle)).toBeInTheDocument();

      const select = screen.getByLabelText(es.tasks.selectGroupLabel);
      await user.selectOptions(select, 'grp-work');

      const confirmButton = screen.getByRole('button', { name: es.tasks.confirmMove });
      await user.click(confirmButton);

      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();

      // Task in repo has updated groupId, preserving id and createdAt
      const moved = await taskRepository.getById(sampleTask.id);
      expect(moved).not.toBeNull();
      expect(moved?.groupId).toBe('grp-work');
      expect(moved?.id).toBe(sampleTask.id);
      expect(moved?.createdAt).toBe(sampleTask.createdAt);
    });

    it('should copy task into destination group with new id and current timestamp (REQ-TK-21)', async () => {
      const user = userEvent.setup();
      await groupRepository.save(workGroup);
      await useTasksStore.getState().init();

      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(
        <TaskMoveCopyModal
          show={true}
          mode="copy"
          task={sampleTask}
          onClose={onClose}
          onSuccess={onSuccess}
        />,
      );

      expect(screen.getByText(es.tasks.copyTitle)).toBeInTheDocument();

      const select = screen.getByLabelText(es.tasks.selectGroupLabel);
      await user.selectOptions(select, 'grp-work');

      const confirmButton = screen.getByRole('button', { name: es.tasks.confirmCopy });
      await user.click(confirmButton);

      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();

      // Original task still exists
      const original = await taskRepository.getById(sampleTask.id);
      expect(original?.groupId).toBe(SEED_PERSONAL_GROUP.id);

      // Destination group has the copied task with new id
      const allTasks = await taskRepository.getAll();
      const copied = allTasks.find(
        (t) => t.groupId === 'grp-work' && t.title === sampleTask.title,
      );
      expect(copied).toBeDefined();
      expect(copied?.id).not.toBe(sampleTask.id);
      expect(copied?.createdAt).toBeDefined();
    });
  });

  describe('TaskDeleteConfirmModal (REQ-TK-07, REQ-TK-08, UI-06)', () => {
    it('should render permanent deletion warning message (REQ-TK-07)', () => {
      render(
        <TaskDeleteConfirmModal
          show={true}
          task={sampleTask}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByText(es.tasks.deleteTitle)).toBeInTheDocument();
      expect(screen.getByText(es.tasks.deleteMessage)).toBeInTheDocument();
      expect(screen.getByText(sampleTask.title)).toBeInTheDocument();
    });

    it('should permanently remove task upon confirmation (REQ-TK-08)', async () => {
      const user = userEvent.setup();
      await useTasksStore.getState().init();

      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(
        <TaskDeleteConfirmModal
          show={true}
          task={sampleTask}
          onClose={onClose}
          onSuccess={onSuccess}
        />,
      );

      const deleteBtn = screen.getByRole('button', { name: es.tasks.confirmDelete });
      await user.click(deleteBtn);

      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();

      const afterDelete = await taskRepository.getById(sampleTask.id);
      expect(afterDelete).toBeNull();
      expect(useTasksStore.getState().tasks).toHaveLength(0);
    });
  });
});
