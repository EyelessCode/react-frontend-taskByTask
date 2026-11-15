import { useId, useImperativeHandle, useRef, type Ref } from 'react';
import Badge from 'react-bootstrap/Badge';
import Form from 'react-bootstrap/Form';
import ListGroup from 'react-bootstrap/ListGroup';
import type { Tag } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';
import { useTagInput } from '../hooks';

export interface TaskTagInputHandle {
  commitPendingInput: () => { ok: boolean; tags: string[] };
  focusInput: () => void;
}

export interface TaskTagInputProps {
  value?: string[];
  onChange?: (tags: string[]) => void;
  availableTags?: Tag[];
  persistedTagNames?: string[];
  onRemoveRequest?: (tagName: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ref?: Ref<TaskTagInputHandle>;
}

/**
 * Accessible tag chip input supporting delimited capture, inline chip editing,
 * group-scoped autocomplete suggestions, and composite blur auto-capture.
 */
export function TaskTagInput({
  value = [],
  onChange,
  availableTags = [],
  persistedTagNames = [],
  onRemoveRequest,
  disabled = false,
  placeholder = es.tasks.tagsPlaceholder,
  ref,
}: TaskTagInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();

  const {
    inputValue,
    inputError,
    isFocused,
    setIsFocused,
    editingIndex,
    editingValue,
    inlineError,
    suggestions,
    handleInputChange,
    handleInputKeyDown,
    handleCompositeBlur,
    selectSuggestion,
    startInlineEdit,
    handleInlineValueChange,
    handleInlineKeyDown,
    handleInlineBlur,
    handleChipRemoveClick,
    commitPendingBeforeSubmit,
  } = useTagInput({
    value,
    onChange,
    availableTags,
    persistedTagNames,
    onRemoveRequest,
  });

  useImperativeHandle(ref, () => ({
    commitPendingInput: commitPendingBeforeSubmit,
    focusInput: () => inputRef.current?.focus(),
  }));

  return (
    <div className="position-relative" ref={containerRef}>
      {value.length > 0 && (
        <div className="d-flex flex-wrap align-items-center gap-1 mb-2">
          {value.map((tagName, index) =>
            editingIndex === index ? (
              <div key={`${tagName}-${index}`} className="d-inline-flex flex-column">
                <Form.Control
                  type="text"
                  size="sm"
                  autoFocus
                  disabled={disabled}
                  value={editingValue}
                  aria-label={es.tasks.editingTagInputAria(tagName)}
                  isInvalid={Boolean(inlineError)}
                  onChange={(e) => handleInlineValueChange(e.target.value)}
                  onKeyDown={handleInlineKeyDown}
                  onBlur={handleInlineBlur}
                  style={{ width: 'auto', minWidth: '8rem', maxWidth: '100%' }}
                />
                {inlineError && (
                  <Form.Control.Feedback type="invalid" className="d-block">
                    {inlineError}
                  </Form.Control.Feedback>
                )}
              </div>
            ) : (
              <Badge
                key={`${tagName}-${index}`}
                bg="secondary"
                className="d-flex align-items-center gap-1 py-1 px-2 fw-normal text-white"
              >
                <span
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-label={es.tasks.editTagAria(tagName)}
                  onClick={() => {
                    if (!disabled) startInlineEdit(index);
                  }}
                  onKeyDown={(e) => {
                    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      startInlineEdit(index);
                    }
                  }}
                  style={{ cursor: disabled ? 'default' : 'pointer' }}
                >
                  {tagName}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    className="btn-close btn-close-white p-0 ms-1"
                    style={{ width: '0.5rem', height: '0.5rem' }}
                    aria-label={es.tasks.removeTagAria(tagName)}
                    onClick={() => handleChipRemoveClick(tagName)}
                  />
                )}
              </Badge>
            ),
          )}
        </div>
      )}

      <Form.Control
        ref={inputRef}
        type="text"
        size="sm"
        disabled={disabled}
        placeholder={placeholder}
        aria-label={es.tasks.tagsLabel}
        aria-describedby={value.length > 0 ? hintId : undefined}
        value={inputValue}
        isInvalid={Boolean(inputError)}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => handleCompositeBlur(e.relatedTarget, containerRef.current)}
      />

      {inputError && (
        <Form.Control.Feedback type="invalid" className="d-block">
          {inputError}
        </Form.Control.Feedback>
      )}

      {value.length > 0 && (
        <Form.Text id={hintId} className="text-muted d-block mt-1">
          {es.tasks.editTagHint}
        </Form.Text>
      )}

      {isFocused && suggestions.length > 0 && (
        <ListGroup
          className="position-absolute w-100 shadow-sm mt-1 z-3"
          style={{ maxHeight: '180px', overflowY: 'auto' }}
        >
          {suggestions.map((suggestion) => (
            <ListGroup.Item
              key={suggestion.id}
              action
              as="button"
              type="button"
              className="py-1 px-3 small text-start"
              onClick={() => selectSuggestion(suggestion.name)}
              onBlur={(e) => handleCompositeBlur(e.relatedTarget, containerRef.current)}
            >
              <span aria-hidden="true" className="me-1">
                🏷️
              </span>
              <span>{suggestion.name}</span>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </div>
  );
}
