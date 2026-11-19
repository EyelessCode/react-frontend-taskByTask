import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskCard } from '@/features/tasks/components/TaskCard';
import { TaskList } from '@/features/tasks/components/TaskList';
import { TaskFilterTabs } from '@/features/tasks/components/TaskFilterTabs';
import type { Task, Tag } from '@/shared/schemas';
import { es } from '@/shared/i18n';

describe('TaskCard, TaskList, TaskFilterTabs (integration/features/tasks)', () => {
  const sampleTags: Tag[] = [
    { id: 'tag-1', name: 'Frontend', groupId: 'grp-personal' },
    { id: 'tag-2', name: 'Backend', groupId: 'grp-personal' },
    { id: 'tag-3', name: 'Base de Datos', groupId: 'grp-personal' },
    { id: 'tag-4', name: 'DevOps', groupId: 'grp-personal' },
    { id: 'tag-5', name: 'Testing', groupId: 'grp-personal' },
    { id: 'tag-6', name: 'Diseño', groupId: 'grp-personal' },
    { id: 'tag-7', name: 'Documentación', groupId: 'grp-personal' },
  ];

  const baseTask: Task = {
    id: 'task-100',
    title: 'Tarea regular',
    description: 'Descripción básica',
    groupId: 'grp-personal',
    completed: false,
    createdAt: '2026-11-01T10:00:00.000Z',
    dueDate: '2026-12-01',
    dueTime: '18:00',
    tagIds: ['tag-1', 'tag-2'],
  };

  describe('Visual Status & Overdue Invariants (REQ-TK-11..15, UI-04, RNF-12)', () => {
    it('should render pending on-time task normally without red styling or Vencida badge', () => {
      const now = new Date('2026-11-15T10:00:00.000Z');
      const { container } = render(
        <TaskCard task={baseTask} tags={sampleTags} now={now} timeZone="UTC" />,
      );

      expect(screen.getByText('Tarea regular')).toBeInTheDocument();
      expect(screen.queryByText(es.tasks.badgeOverdue)).not.toBeInTheDocument();

      const card = container.querySelector('.card');
      expect(card?.classList.contains('border-danger')).toBe(false);
    });

    it('should render pending overdue task with border-danger, text-danger, and Vencida badge', () => {
      const overdueTask: Task = {
        ...baseTask,
        dueDate: '2026-11-01',
        dueTime: '10:00',
      };
      const now = new Date('2026-11-02T10:00:00.000Z');

      const { container } = render(
        <TaskCard task={overdueTask} tags={sampleTags} now={now} timeZone="UTC" />,
      );

      const badge = screen.getByText(es.tasks.badgeOverdue);
      expect(badge).toBeInTheDocument();
      expect(badge.classList.contains('bg-danger')).toBe(true);

      const card = container.querySelector('.card');
      expect(card?.classList.contains('border-danger')).toBe(true);

      const title = screen.getByText('Tarea regular');
      expect(title.classList.contains('text-danger')).toBe(true);
    });

    it('should evaluate date-only task cutoff at 23:59:59.999 local time (REQ-TK-12)', () => {
      const dateOnlyTask: Task = {
        ...baseTask,
        dueDate: '2026-11-10',
        dueTime: null,
      };

      // Before end of day in UTC
      const beforeCutoff = new Date('2026-11-10T23:59:59.000Z');
      const { rerender } = render(
        <TaskCard task={dateOnlyTask} tags={sampleTags} now={beforeCutoff} timeZone="UTC" />,
      );
      expect(screen.queryByText(es.tasks.badgeOverdue)).not.toBeInTheDocument();

      // After end of day in UTC
      const afterCutoff = new Date('2026-11-11T00:00:01.000Z');
      rerender(
        <TaskCard task={dateOnlyTask} tags={sampleTags} now={afterCutoff} timeZone="UTC" />,
      );
      expect(screen.getByText(es.tasks.badgeOverdue)).toBeInTheDocument();
    });

    it('should render completed task with strikethrough styling (REQ-TK-13)', () => {
      const completedTask: Task = {
        ...baseTask,
        completed: true,
        completedAt: '2026-11-02T10:00:00.000Z',
      };

      render(<TaskCard task={completedTask} tags={sampleTags} />);

      const title = screen.getByText('Tarea regular');
      expect(
        title.classList.contains('text-decoration-line-through') ||
          title.style.textDecoration.includes('line-through'),
      ).toBe(true);
    });

    it('should render completed overdue task with strikethrough only, NO red border and NO Vencida badge (REQ-TK-14)', () => {
      const completedOverdueTask: Task = {
        ...baseTask,
        dueDate: '2026-11-01',
        dueTime: '08:00',
        completed: true,
        completedAt: '2026-11-02T10:00:00.000Z',
      };
      const now = new Date('2026-11-03T10:00:00.000Z');

      const { container } = render(
        <TaskCard task={completedOverdueTask} tags={sampleTags} now={now} timeZone="UTC" />,
      );

      const title = screen.getByText('Tarea regular');
      expect(
        title.classList.contains('text-decoration-line-through') ||
          title.style.textDecoration.includes('line-through'),
      ).toBe(true);
      expect(title.classList.contains('text-danger')).toBe(false);

      expect(screen.queryByText(es.tasks.badgeOverdue)).not.toBeInTheDocument();

      const card = container.querySelector('.card');
      expect(card?.classList.contains('border-danger')).toBe(false);
    });
  });

  describe('Tag Preview Limit & Overflow Badge (REQ-TK-25)', () => {
    it('should display up to 5 tag chips and render overflow badge for additional tags', () => {
      const taskWith7Tags: Task = {
        ...baseTask,
        tagIds: sampleTags.map((t) => t.id), // 7 tags
      };

      render(<TaskCard task={taskWith7Tags} tags={sampleTags} />);

      // First 5 tags should be visible
      expect(screen.getByText('Frontend')).toBeInTheDocument();
      expect(screen.getByText('Backend')).toBeInTheDocument();
      expect(screen.getByText('Base de Datos')).toBeInTheDocument();
      expect(screen.getByText('DevOps')).toBeInTheDocument();
      expect(screen.getByText('Testing')).toBeInTheDocument();

      // 6th and 7th tags should not be rendered directly
      expect(screen.queryByText('Diseño')).not.toBeInTheDocument();
      expect(screen.queryByText('Documentación')).not.toBeInTheDocument();

      // Overflow badge +2 más
      expect(screen.getByText('+2 más')).toBeInTheDocument();
    });
  });

  describe('Date & Time Formatting (REQ-TK-29)', () => {
    it('should format due date as dd/mm/aaaa and default due time in 24h', () => {
      const taskWithDate: Task = {
        ...baseTask,
        dueDate: '2026-12-25',
        dueTime: '15:45',
      };

      render(<TaskCard task={taskWithDate} tags={sampleTags} />);

      expect(screen.getByText(/25\/12\/2026/)).toBeInTheDocument();
      expect(screen.getByText(/15:45/)).toBeInTheDocument();
    });

    it('should format due time in 12h format when configured', () => {
      const taskWithDate: Task = {
        ...baseTask,
        dueDate: '2026-12-25',
        dueTime: '15:45',
      };

      render(<TaskCard task={taskWithDate} tags={sampleTags} timeFormat="12h" />);

      expect(screen.getByText(/03:45 p\. m\./)).toBeInTheDocument();
    });
  });

  describe('Options Action Menu (REQ-TK-18, UI-03)', () => {
    it('should open dropdown menu with accessible Spanish label and trigger action callbacks', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      const onMove = vi.fn();
      const onCopy = vi.fn();
      const onDelete = vi.fn();
      const onToggleComplete = vi.fn();

      render(
        <TaskCard
          task={baseTask}
          tags={sampleTags}
          onEdit={onEdit}
          onMove={onMove}
          onCopy={onCopy}
          onDelete={onDelete}
          onToggleComplete={onToggleComplete}
        />,
      );

      // Checkbox toggle
      const checkbox = screen.getByRole('checkbox', { name: /Marcar tarea/i });
      await user.click(checkbox);
      expect(onToggleComplete).toHaveBeenCalledWith(baseTask.id);

      // Menu button
      const menuButton = screen.getByRole('button', { name: es.tasks.actionMenuAria });
      expect(menuButton).toBeInTheDocument();

      await user.click(menuButton);

      // Action items
      const editItem = screen.getByRole('button', { name: es.tasks.actionEdit });
      const moveItem = screen.getByRole('button', { name: es.tasks.actionMove });
      const copyItem = screen.getByRole('button', { name: es.tasks.actionCopy });
      const deleteItem = screen.getByRole('button', { name: es.tasks.actionDelete });

      expect(editItem).toBeInTheDocument();
      expect(moveItem).toBeInTheDocument();
      expect(copyItem).toBeInTheDocument();
      expect(deleteItem).toBeInTheDocument();

      await user.click(editItem);
      expect(onEdit).toHaveBeenCalledWith(baseTask);

      await user.click(menuButton);
      await user.click(moveItem);
      expect(onMove).toHaveBeenCalledWith(baseTask);

      await user.click(menuButton);
      await user.click(copyItem);
      expect(onCopy).toHaveBeenCalledWith(baseTask);

      await user.click(menuButton);
      await user.click(deleteItem);
      expect(onDelete).toHaveBeenCalledWith(baseTask);
    });

    it('should render per-chip remove button triggering onRemoveTag and accessible overflow badge aria-label', async () => {
      const user = userEvent.setup();
      const onRemoveTag = vi.fn();
      const manyTagsTask: Task = {
        ...baseTask,
        tagIds: ['tag-1', 'tag-2', 'tag-3', 'tag-4', 'tag-5', 'tag-6', 'tag-7'],
      };

      render(
        <TaskCard
          task={manyTagsTask}
          tags={sampleTags}
          onRemoveTag={onRemoveTag}
        />,
      );

      const overflowBadge = screen.getByText('+2 más');
      expect(overflowBadge).toHaveAttribute('aria-label', es.tasks.tagOverflowAria(2));

      const removeFrontendBtn = screen.getByRole('button', {
        name: es.tasks.removeTagAria('Frontend'),
      });
      await user.click(removeFrontendBtn);
      expect(onRemoveTag).toHaveBeenCalledWith(manyTagsTask, sampleTags[0]);
    });
  });

  describe('TaskList component', () => {
    it('should render empty state message when tasks array is empty', () => {
      const { rerender } = render(
        <TaskList tasks={[]} tags={sampleTags} filter="pendientes" />,
      );
      expect(screen.getByText(es.tasks.emptyPending)).toBeInTheDocument();

      rerender(<TaskList tasks={[]} tags={sampleTags} filter="completadas" />);
      expect(screen.getByText(es.tasks.emptyCompleted)).toBeInTheDocument();

      rerender(<TaskList tasks={[]} tags={sampleTags} filter="todas" />);
      expect(screen.getByText(es.tasks.emptyAll)).toBeInTheDocument();
    });

    it('should render task cards when tasks are present', () => {
      render(<TaskList tasks={[baseTask]} tags={sampleTags} filter="pendientes" />);
      expect(screen.getByText('Tarea regular')).toBeInTheDocument();
    });
  });

  describe('TaskFilterTabs component', () => {
    it('should render filter tabs with counts and handle switching', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();

      render(
        <TaskFilterTabs
          activeFilter="pendientes"
          counts={{ pending: 3, completed: 2, all: 5 }}
          onFilterChange={onFilterChange}
        />,
      );

      const pendingTab = screen.getByRole('tab', { name: /Pendientes \(3\)/i });
      const completedTab = screen.getByRole('tab', { name: /Completadas \(2\)/i });
      const allTab = screen.getByRole('tab', { name: /Todas \(5\)/i });

      expect(pendingTab).toBeInTheDocument();
      expect(completedTab).toBeInTheDocument();
      expect(allTab).toBeInTheDocument();

      await user.click(completedTab);
      expect(onFilterChange).toHaveBeenCalledWith('completadas');

      await user.click(allTab);
      expect(onFilterChange).toHaveBeenCalledWith('todas');
    });
  });
});
