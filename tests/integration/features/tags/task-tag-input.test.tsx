import { useState, useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TaskTagInput,
  type TaskTagInputHandle,
} from '@/features/tags/components/TaskTagInput';
import { TaskTagRemovalModal } from '@/features/tags/components/TaskTagRemovalModal';
import type { Tag } from '@/shared/schemas';
import { es } from '@/shared/i18n';

const sampleTags: Tag[] = [
  { id: 't1', name: 'Frontend', groupId: 'g1' },
  { id: 't2', name: 'Trabajo', groupId: 'g1' },
  { id: 't3', name: 'Urgente', groupId: 'g1' },
];

function ControlledTagInput({
  initialValue = [],
  persistedTagNames = [],
  onRemoveRequest,
}: {
  initialValue?: string[];
  persistedTagNames?: string[];
  onRemoveRequest?: (tagName: string) => void;
}) {
  const [tags, setTags] = useState<string[]>(initialValue);
  const inputHandleRef = useRef<TaskTagInputHandle>(null);

  return (
    <div>
      <TaskTagInput
        ref={inputHandleRef}
        value={tags}
        onChange={setTags}
        availableTags={sampleTags}
        persistedTagNames={persistedTagNames}
        onRemoveRequest={onRemoveRequest}
      />
      <button type="button">Botón externo</button>
    </div>
  );
}

describe('TaskTagInput & TaskTagRemovalModal (integration/features/tags)', () => {
  describe('Delimited capture, paste, and > 30 char validation', () => {
    it('captures tags via semicolon, comma, Enter, and multi-tag paste; ignores empty delimiter press', async () => {
      const user = userEvent.setup();
      render(<ControlledTagInput />);

      const input = screen.getByPlaceholderText(es.tasks.tagsPlaceholder);

      // Empty delimiter press is a no-op
      await user.type(input, ';,{enter}');
      expect(screen.queryByRole('button', { name: /Quitar etiqueta/i })).not.toBeInTheDocument();

      // Semicolon, comma, Enter
      await user.type(input, 'Alpha;Beta,Gamma{enter}');
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.getByText('Gamma')).toBeInTheDocument();
      expect(input).toHaveValue('');

      // Multi-tag paste
      fireEvent.change(input, { target: { value: 'Uno; Dos, Tres;' } });
      expect(screen.getByText('Uno')).toBeInTheDocument();
      expect(screen.getByText('Dos')).toBeInTheDocument();
      expect(screen.getByText('Tres')).toBeInTheDocument();
    });

    it('displays Spanish max-length error and retains text when > 30 chars on delimiter, Enter, or external blur', async () => {
      const user = userEvent.setup();
      render(<ControlledTagInput />);

      const input = screen.getByPlaceholderText(es.tasks.tagsPlaceholder);
      const overLimit = 'a'.repeat(31);
      const expectedError = es.validation.maxLength('El nombre de la etiqueta', 30);

      await user.type(input, `${overLimit};`);
      expect(screen.getByText(expectedError)).toBeInTheDocument();
      expect(input).toHaveValue(overLimit);

      await user.type(input, '{enter}');
      expect(screen.getByText(expectedError)).toBeInTheDocument();

      // External blur also shows error and retains text
      await user.click(screen.getByRole('button', { name: 'Botón externo' }));
      expect(screen.getByText(expectedError)).toBeInTheDocument();
      expect(input).toHaveValue(overLimit);
    });
  });

  describe('Composite blur boundary (REQ-TG-06b)', () => {
    it('preserves partial query when Tab-navigating to suggestion button, and auto-captures when blurring outside', async () => {
      const user = userEvent.setup();
      render(<ControlledTagInput />);

      const input = screen.getByPlaceholderText(es.tasks.tagsPlaceholder);
      await user.type(input, 'front');

      const suggestion = screen.getByRole('button', { name: 'Frontend' });
      expect(suggestion).toBeInTheDocument();

      // Tab moves focus from input into suggestion inside composite container
      await user.tab();
      expect(suggestion).toHaveFocus();
      expect(screen.queryByRole('button', { name: es.tasks.removeTagAria('front') })).not.toBeInTheDocument();

      // Pressing Enter selects the canonical suggestion and keeps focus on the main tag input
      await user.keyboard('{Enter}');
      expect(screen.getByText('Frontend')).toBeInTheDocument();
      expect(input).toHaveValue('');
      expect(input).toHaveFocus();

      // Pointer-clicking a suggestion also returns focus to the main tag input
      await user.type(input, 'trab');
      await user.click(screen.getByRole('button', { name: 'Trabajo' }));
      expect(screen.getByText('Trabajo')).toBeInTheDocument();
      expect(input).toHaveValue('');
      expect(input).toHaveFocus();

      // Typing a new valid tag and blurring outside the composite container auto-captures it
      await user.type(input, 'NuevaEtiqueta');
      await user.click(screen.getByRole('button', { name: 'Botón externo' }));
      expect(screen.getByText('NuevaEtiqueta')).toBeInTheDocument();
      expect(input).toHaveValue('');
    });
  });

  describe('Inline chip editing (REQ-TG-11..13, AC-TG-05)', () => {
    it('activates inline edit via click, Enter, or Space and confirms via Enter, comma, semicolon, or blur', async () => {
      const user = userEvent.setup();
      render(<ControlledTagInput initialValue={['Inicial', 'Otra']} />);

      // Activate via click
      await user.click(screen.getByRole('button', { name: es.tasks.editTagAria('Inicial') }));
      const editInput = screen.getByRole('textbox', { name: es.tasks.editingTagInputAria('Inicial') });
      expect(editInput).toHaveFocus();

      await user.clear(editInput);
      await user.type(editInput, 'Renombrada{enter}');
      expect(screen.getByText('Renombrada')).toBeInTheDocument();
      expect(screen.queryByText('Inicial')).not.toBeInTheDocument();

      // Activate via Space and confirm via blur
      const chipTrigger = screen.getByRole('button', { name: es.tasks.editTagAria('Renombrada') });
      chipTrigger.focus();
      await user.keyboard(' ');
      const secondEditInput = screen.getByRole('textbox', {
        name: es.tasks.editingTagInputAria('Renombrada'),
      });
      await user.clear(secondEditInput);
      await user.type(secondEditInput, 'trabajo'); // canonical group casing -> "Trabajo"
      await user.click(screen.getByRole('button', { name: 'Botón externo' }));
      expect(screen.getByText('Trabajo')).toBeInTheDocument();
    });

    it('shows error on Enter with > 30 chars and reverts on Escape or empty/over-limit blur', async () => {
      const user = userEvent.setup();
      render(<ControlledTagInput initialValue={['Trabajo', 'Urgente']} />);

      await user.click(screen.getByRole('button', { name: es.tasks.editTagAria('Trabajo') }));
      const editInput = screen.getByRole('textbox', { name: es.tasks.editingTagInputAria('Trabajo') });

      await user.clear(editInput);
      await user.type(editInput, `${'x'.repeat(31)}{enter}`);
      expect(
        screen.getByText(es.validation.maxLength('El nombre de la etiqueta', 30)),
      ).toBeInTheDocument();
      expect(editInput).toBeInTheDocument();

      // Escape cancels edit and restores original chip
      await user.keyboard('{Escape}');
      expect(screen.getByRole('button', { name: es.tasks.editTagAria('Trabajo') })).toBeInTheDocument();

      // Deduplicates when edited to match another chip on the task
      await user.click(screen.getByRole('button', { name: es.tasks.editTagAria('Trabajo') }));
      const dedupInput = screen.getByRole('textbox', { name: es.tasks.editingTagInputAria('Trabajo') });
      await user.clear(dedupInput);
      await user.type(dedupInput, 'urgente{enter}');
      expect(screen.queryByRole('button', { name: es.tasks.editTagAria('Trabajo') })).not.toBeInTheDocument();
      expect(screen.getAllByText('Urgente')).toHaveLength(1);
    });
  });

  describe('Persisted vs. session chip removal & TaskTagRemovalModal', () => {
    it('calls onRemoveRequest for persisted chips and removes session/inline-rewritten chips immediately', async () => {
      const user = userEvent.setup();
      const onRemoveRequest = vi.fn();
      render(
        <ControlledTagInput
          initialValue={['Persistida', 'Temporal']}
          persistedTagNames={['Persistida']}
          onRemoveRequest={onRemoveRequest}
        />,
      );

      // Clicking × on persisted chip calls onRemoveRequest
      await user.click(screen.getByRole('button', { name: es.tasks.removeTagAria('Persistida') }));
      expect(onRemoveRequest).toHaveBeenCalledWith('Persistida');
      expect(screen.getByText('Persistida')).toBeInTheDocument();

      // Clicking × on session chip removes it immediately
      await user.click(screen.getByRole('button', { name: es.tasks.removeTagAria('Temporal') }));
      expect(screen.queryByText('Temporal')).not.toBeInTheDocument();

      // Inline-rewritten chip becomes a session chip and removes immediately
      await user.click(screen.getByRole('button', { name: es.tasks.editTagAria('Persistida') }));
      const editInput = screen.getByRole('textbox', {
        name: es.tasks.editingTagInputAria('Persistida'),
      });
      await user.clear(editInput);
      await user.type(editInput, 'Reescrita{enter}');

      await user.click(screen.getByRole('button', { name: es.tasks.removeTagAria('Reescrita') }));
      expect(screen.queryByText('Reescrita')).not.toBeInTheDocument();
      expect(onRemoveRequest).toHaveBeenCalledTimes(1);
    });

    it('renders UI-06 consequence warning description in TaskTagRemovalModal', () => {
      render(
        <TaskTagRemovalModal
          show={true}
          tagName="Trabajo"
          onClose={vi.fn()}
          onRemoveOnlyFromTask={vi.fn()}
          onRemoveFromGroup={vi.fn()}
        />,
      );

      expect(screen.getByText(es.tasks.removeTagDescription)).toBeInTheDocument();
    });
  });
});
