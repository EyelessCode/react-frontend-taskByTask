import { useState, useRef, type KeyboardEvent, type ChangeEvent } from 'react';
import Badge from 'react-bootstrap/Badge';
import Form from 'react-bootstrap/Form';
import ListGroup from 'react-bootstrap/ListGroup';
import type { Tag } from '../../../shared/schemas';
import { LIMITS } from '../../../shared/schemas';
import { es } from '../../../shared/i18n';

export interface TaskTagInputProps {
  value?: string[];
  onChange?: (tags: string[]) => void;
  availableTags?: Tag[];
  onRemoveRequest?: (tagName: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TaskTagInput({
  value = [],
  onChange,
  availableTags = [],
  onRemoveRequest,
  disabled = false,
  placeholder = es.tasks.tagsPlaceholder,
}: TaskTagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const addTag = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (
      trimmed.length < LIMITS.TAG_NAME_MIN ||
      trimmed.length > LIMITS.TAG_NAME_MAX
    ) {
      return;
    }
    if (trimmed.includes(';') || trimmed.includes(',')) {
      return;
    }

    // Check duplicate case-insensitively
    const isDuplicate = value.some(
      (v) => v.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (!isDuplicate) {
      onChange?.([...value, trimmed]);
    }
    setInputValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ';' || e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(';') || val.includes(',')) {
      const parts = val.split(/[;,]/);
      for (const part of parts.slice(0, -1)) {
        addTag(part);
      }
      setInputValue(parts[parts.length - 1] ?? '');
    } else {
      setInputValue(val);
    }
  };

  const handleRemoveChip = (tagName: string) => {
    if (onRemoveRequest) {
      onRemoveRequest(tagName);
    } else {
      onChange?.(value.filter((t) => t !== tagName));
    }
  };

  // Autocomplete suggestions
  const query = inputValue.trim().toLowerCase();
  const suggestions =
    query.length > 0
      ? availableTags.filter(
          (t) =>
            t.name.toLowerCase().includes(query) &&
            !value.some((v) => v.trim().toLowerCase() === t.name.toLowerCase()),
        )
      : [];

  return (
    <div className="position-relative" ref={containerRef}>
      {/* Existing Tag Chips */}
      {value.length > 0 && (
        <div className="d-flex flex-wrap gap-1 mb-2">
          {value.map((tagName) => (
            <Badge
              key={tagName}
              bg="secondary"
              className="d-flex align-items-center gap-1 py-1 px-2 fw-normal text-white"
            >
              <span>{tagName}</span>
              {!disabled && (
                <button
                  type="button"
                  className="btn-close btn-close-white p-0 ms-1"
                  style={{ width: '0.5rem', height: '0.5rem' }}
                  aria-label={`Quitar etiqueta ${tagName}`}
                  onClick={() => handleRemoveChip(tagName)}
                />
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Input Field */}
      <Form.Control
        type="text"
        size="sm"
        disabled={disabled}
        placeholder={placeholder}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          // Delay closing suggestions to allow click events to register
          setTimeout(() => setIsFocused(false), 200);
        }}
      />

      {/* Suggestions Dropdown */}
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
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(suggestion.name);
              }}
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
