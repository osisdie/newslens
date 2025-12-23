import React, { useState, useRef, useEffect } from 'react';
import './TagInput.css';

export default function TagInput({ tags, onChange, placeholder = "Add keywords...", disabled = false }) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleInputKeyDown = (e) => {
    if (disabled) return;

    // Handle Enter, comma, or semicolon to add tag
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault();
      addTag(inputValue.trim());
    }
    // Handle Backspace to remove last tag if input is empty
    else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleInputBlur = () => {
    // Add tag when input loses focus if there's text
    if (inputValue.trim()) {
      addTag(inputValue.trim());
    }
  };

  const addTag = (tag) => {
    if (!tag) return;
    
    // Split by comma or semicolon if multiple tags entered at once
    const newTags = tag.split(/[,;]/).map(t => t.trim()).filter(t => t);
    
    const updatedTags = [...tags];
    newTags.forEach(newTag => {
      if (newTag && !updatedTags.includes(newTag)) {
        updatedTags.push(newTag);
      }
    });
    
    onChange(updatedTags);
    setInputValue('');
  };

  const removeTag = (index) => {
    const updatedTags = tags.filter((_, i) => i !== index);
    onChange(updatedTags);
  };

  return (
    <div className="tag-input-container">
      <div className="tags-display">
        {tags.map((tag, index) => (
          <span key={index} className="tag-item">
            {tag}
            {!disabled && (
              <button
                type="button"
                className="tag-remove"
                onClick={() => removeTag(index)}
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="tag-input-field"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled}
        />
      </div>
      <div className="tag-input-hint">
        Press Enter, comma, or semicolon to add a tag
      </div>
    </div>
  );
}

