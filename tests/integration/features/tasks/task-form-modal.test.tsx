import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
import { TaskFormModal } from '@/features/tasks/components/TaskFormModal';
import { TaskTagInput } from '@/features/tasks/components/TaskTagInput';
import { TaskTagRemovalModal } from '@/features/tasks/components/TaskTagRemovalModal';
import { SEED_PERSONAL_GROUP, type Tag, type Task } from '@/shared/schemas';
import { es } from '@/shared/i18n';

describe('TaskFormModal, TaskTagInput, TaskTagRemovalModal (integration/features/tasks)', () => {
  let mockStorage: MockStorage;
  let adapter: LocalStorageAdapter;
  let taskRepository: LocalStorageTaskRepository;
  let groupRepository: LocalStorageGroupRepository;
  let tagRepository: LocalStorageTagRepository;

  const sampleTags: Tag[] = [
    { id: 'tag-frontend', name: 'Frontend', groupId: SEED_PERSONAL_GROUP.id },
    { id: 'tag-backend', name: 'Backend', groupId: SEED_PERSONAL_GROUP.id },
    { id: 'tag-urgent', name: 'Urgente', groupId: SEED_PERSONAL_GROUP.id },
  ];

  beforeEach(async () => {
    mockStorage = new MockStorage();
    adapter = new LocalStorageAdapter(mockStorage);
    taskRepository = new LocalStorageTaskRepository(adapter);
    groupRepository = new LocalStorageGroupRepository(adapter);
    tagRepository = new LocalStorageTagRepository(adapter);

    for (const tag of sampleTags) {
      await tagRepository.save(tag);
    }

    configureTasksStore({
      taskRepository,
      groupRepository,
      tagRepository,
      getActiveUserId: () => Promise.resolve('local-user'),
    });
    resetTasksStore();
    await groupRepository.ensureSeedGroup();
    await useTasksStore.getState().init();
  });

  describe('TaskTagInput (REQ-TK-24, REQ-TK-24b, REQ-TK-24c)', () => {
    it('should convert text to tag chip upon typing semicolon or comma', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <TaskTagInput
          value={[]}
          onChange={onChange}
          availableTags={sampleTags}
        />,
      );

      const input = screen.getByPlaceholderText(es.tasks.tagsPlaceholder);

      // Type "Arquitectura;"
      await user.type(input, 'Arquitectura;');
      expect(onChange).toHaveBeenCalledWith(['Arquitectura']);

      // Type "Diseño,"
      await user.type(input, 'Diseño,');
      expect(onChange).toHaveBeenCalledWith(['Diseño']);
    });

    it('should show matching autocomplete suggestions from group tags and allow selection', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <TaskTagInput
          value={[]}
          onChange={onChange}
          availableTags={sampleTags}
        />,
      );

      const input = screen.getByPlaceholderText(es.tasks.tagsPlaceholder);
      await user.type(input, 'front');

      // Autocomplete suggestion should appear
      const suggestion = screen.getByRole('button', { name: 'Frontend' });
      expect(suggestion).toBeInTheDocument();

      await user.click(suggestion);
      expect(onChange).toHaveBeenCalledWith(['Frontend']);
    });

    it('should prevent duplicate tag chips in the same list (REQ-TK-24c)', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <TaskTagInput
          value={['Frontend']}
          onChange={onChange}
          availableTags={sampleTags}
        />,
      );

      const input = screen.getByPlaceholderText(es.tasks.tagsPlaceholder);
      await user.type(input, 'frontend;');
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('TaskTagRemovalModal (REQ-TK-26)', () => {
    it('should display options "Solo de la tarea" and "Del grupo" and trigger respective callbacks', async () => {
      const user = userEvent.setup();
      const onRemoveOnlyFromTask = vi.fn();
      const onRemoveFromGroup = vi.fn();
      const onClose = vi.fn();

      render(
        <TaskTagRemovalModal
          show={true}
          tagName="Frontend"
          onClose={onClose}
          onRemoveOnlyFromTask={onRemoveOnlyFromTask}
          onRemoveFromGroup={onRemoveFromGroup}
        />,
      );

      expect(screen.getByText(es.tasks.removeTagTitle)).toBeInTheDocument();
      expect(screen.getByText(es.tasks.removeTagPrompt('Frontend'))).toBeInTheDocument();

      const onlyTaskBtn = screen.getByRole('button', { name: es.tasks.removeOnlyFromTask });
      const fromGroupBtn = screen.getByRole('button', { name: es.tasks.removeFromGroup });

      await user.click(onlyTaskBtn);
      expect(onRemoveOnlyFromTask).toHaveBeenCalledTimes(1);

      await user.click(fromGroupBtn);
      expect(onRemoveFromGroup).toHaveBeenCalledTimes(1);
    });
  });

  describe('TaskFormModal (REQ-TK-01, REQ-TK-04, REQ-TK-05, REQ-TK-06)', () => {
    it('should disable due time input when due date is empty (REQ-TK-04)', () => {
      render(
        <TaskFormModal show={true} onClose={vi.fn()} />,
      );

      const timeInput = screen.getByLabelText(es.tasks.dueTimeLabel);
      expect(timeInput).toBeDisabled();

      // Enter a due date
      const dateInput = screen.getByLabelText(es.tasks.dueDateLabel);
      fireEvent.change(dateInput, { target: { value: '2026-11-20' } });

      expect(timeInput).not.toBeDisabled();
    });

    it('should display Spanish validation errors when submitting invalid title', async () => {
      const user = userEvent.setup();
      render(
        <TaskFormModal show={true} onClose={vi.fn()} />,
      );

      const titleInput = screen.getByLabelText(es.tasks.titleLabel);
      await user.type(titleInput, 'a'); // 1 char (< 2 min)

      const saveButton = screen.getByRole('button', { name: es.common.save });
      await user.click(saveButton);

      expect(
        await screen.findByText(es.validation.minLength('El título de la tarea', 2)),
      ).toBeInTheDocument();
    });

    it('should create a task successfully upon submitting valid form', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      const onClose = vi.fn();

      render(
        <TaskFormModal show={true} onClose={onClose} onSuccess={onSuccess} />,
      );

      const titleInput = screen.getByLabelText(es.tasks.titleLabel);
      const descInput = screen.getByLabelText(es.tasks.descLabel);
      const dateInput = screen.getByLabelText(es.tasks.dueDateLabel);

      await user.type(titleInput, 'Aprender Vitest y RTL');
      await user.type(descInput, 'Crear tests unitarios y de integración');
      fireEvent.change(dateInput, { target: { value: '2026-11-25' } });

      const timeInput = screen.getByLabelText(es.tasks.dueTimeLabel);
      fireEvent.change(timeInput, { target: { value: '16:00' } });

      const saveButton = screen.getByRole('button', { name: es.common.save });
      await user.click(saveButton);

      expect(onSuccess).toHaveBeenCalled();
      const state = useTasksStore.getState();
      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0].title).toBe('Aprender Vitest y RTL');
      expect(state.tasks[0].dueDate).toBe('2026-11-25');
      expect(state.tasks[0].dueTime).toBe('16:00');
    });

    it('should pre-populate form in edit mode and update existing task', async () => {
      const user = userEvent.setup();
      const existingTask: Task = {
        id: 'task-editing-1',
        title: 'Título existente',
        description: 'Descripción previa',
        groupId: SEED_PERSONAL_GROUP.id,
        completed: false,
        createdAt: '2026-11-01T10:00:00.000Z',
        dueDate: '2026-11-30',
        dueTime: '12:00',
        tagIds: ['tag-frontend'],
      };
      await taskRepository.save(existingTask);
      await useTasksStore.getState().init();

      const onSuccess = vi.fn();
      render(
        <TaskFormModal
          show={true}
          task={existingTask}
          onClose={vi.fn()}
          onSuccess={onSuccess}
        />,
      );

      expect(screen.getByText(es.tasks.editTitle)).toBeInTheDocument();

      const titleInput = screen.getByLabelText<HTMLInputElement>(es.tasks.titleLabel);
      expect(titleInput.value).toBe('Título existente');

      await user.clear(titleInput);
      await user.type(titleInput, 'Título modificado exitosamente');

      const saveButton = screen.getByRole('button', { name: es.common.save });
      await user.click(saveButton);

      expect(onSuccess).toHaveBeenCalled();
      const state = useTasksStore.getState();
      const updated = state.tasks.find((t) => t.id === existingTask.id);
      expect(updated?.title).toBe('Título modificado exitosamente');
      expect(updated?.createdAt).toBe(existingTask.createdAt); // Preserves immutable createdAt
    });
  });

  describe('TaskFormModal 12h Time Capture (REQ-AU-16, REQ-TK-04)', () => {
    it('captures 12h time bijectively (12:00 am -> 00:00), rejects partial selection, and supports clear/dueDate sync', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      render(
        <TaskFormModal
          show={true}
          timeFormat="12h"
          onClose={vi.fn()}
          onSuccess={onSuccess}
        />,
      );

      const hourSelect = screen.getByLabelText<HTMLSelectElement>(es.auth.timeHourAria);
      const minuteSelect = screen.getByLabelText<HTMLSelectElement>(es.auth.timeMinuteAria);
      const periodSelect = screen.getByLabelText<HTMLSelectElement>(es.auth.timePeriodAria);
      const clearTimeBtn = screen.getByRole('button', { name: es.auth.clearTimeLabel });

      // Disabled when dueDate is empty
      expect(hourSelect).toBeDisabled();
      expect(minuteSelect).toBeDisabled();
      expect(periodSelect).toBeDisabled();
      expect(clearTimeBtn).toBeDisabled();

      await user.type(screen.getByLabelText(es.tasks.titleLabel), 'Tarea 12h medianoche');
      await user.type(screen.getByLabelText(es.tasks.dueDateLabel), '2026-12-01');

      expect(hourSelect).toBeEnabled();
      expect(clearTimeBtn).toBeDisabled();

      // Partial selection -> incompleteTimeError
      await user.selectOptions(hourSelect, '12');
      expect(clearTimeBtn).toBeEnabled();
      await user.click(screen.getByRole('button', { name: es.common.save }));
      expect(await screen.findByText(es.auth.incompleteTimeError)).toBeInTheDocument();
      expect(onSuccess).not.toHaveBeenCalled();

      // Clear button resets time parts
      await user.click(clearTimeBtn);
      expect(hourSelect.value).toBe('');
      expect(clearTimeBtn).toBeDisabled();

      // Complete 12:00 a. m. -> persists as 00:00
      await user.selectOptions(hourSelect, '12');
      await user.selectOptions(minuteSelect, '00');
      await user.selectOptions(periodSelect, 'am');
      await user.click(screen.getByRole('button', { name: es.common.save }));

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(useTasksStore.getState().tasks[0]?.dueTime).toBe('00:00');
    });

    it('pre-populates 12h controls from 24h dueTime in edit mode (13:45 -> 01:45 pm)', () => {
      const existingTask: Task = {
        id: 'task-edit-12h',
        title: 'Editar 12h',
        groupId: SEED_PERSONAL_GROUP.id,
        completed: false,
        createdAt: '2026-11-01T10:00:00.000Z',
        dueDate: '2026-12-01',
        dueTime: '13:45',
        tagIds: [],
      };

      render(
        <TaskFormModal
          show={true}
          task={existingTask}
          timeFormat="12h"
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByLabelText<HTMLSelectElement>(es.auth.timeHourAria).value).toBe('01');
      expect(screen.getByLabelText<HTMLSelectElement>(es.auth.timeMinuteAria).value).toBe('45');
      expect(screen.getByLabelText<HTMLSelectElement>(es.auth.timePeriodAria).value).toBe('pm');
    });
  });
});
