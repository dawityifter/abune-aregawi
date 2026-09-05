import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { SurveyQuestionDef } from './surveyDefinitions';

interface SurveyQuestionProps {
  question: SurveyQuestionDef;
  value: string | string[] | undefined;
  otherValue: string | undefined;
  onChange: (id: string, value: string | string[]) => void;
  onOtherChange: (id: string, text: string) => void;
}

const SurveyQuestion: React.FC<SurveyQuestionProps> = ({ question, value, otherValue, onChange, onOtherChange }) => {
  const { t } = useLanguage();
  const label = t(`survey.${question.id}.label`);
  const showOther = !!question.otherOptionKey && (
    question.type === 'single' ? value === question.otherOptionKey : Array.isArray(value) && value.includes(question.otherOptionKey)
  );

  return (
    <div className="mb-6">
      <p className="font-medium text-primary-700 mb-2">{label}</p>
      {question.maxSelect && (
        <p className="text-xs text-accent-500 mb-2">{t('survey.wizard.selectUpTo', { n: question.maxSelect })}</p>
      )}

      {question.type === 'text' && (
        <textarea
          className="w-full px-4 py-2 border border-accent-200 rounded-md focus:ring-primary-500 focus:border-primary-500"
          rows={3}
          // The server caps the whole serialized answers payload
          // (MAX_ANSWERS_JSON_LENGTH in backend/src/controllers/surveyController.js).
          // Capping each of the 13 free-text answers keeps a verbose respondent
          // from hitting that only at submit time, after filling the whole survey.
          maxLength={2000}
          value={(value as string) || ''}
          onChange={e => onChange(question.id, e.target.value)}
        />
      )}

      {question.type === 'single' && question.optionKeys && (
        <div className="space-y-2">
          {question.optionKeys.map(key => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="radio"
                name={question.id}
                checked={value === key}
                onChange={() => onChange(question.id, key)}
              />
              {t(`survey.${question.id}.options.${key}`)}
            </label>
          ))}
        </div>
      )}

      {question.type === 'multi' && question.optionKeys && (
        <div className="space-y-2">
          {question.optionKeys.map(key => {
            const selected = Array.isArray(value) ? value : [];
            const checked = selected.includes(key);
            const atMax = !!question.maxSelect && selected.length >= question.maxSelect;
            return (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!checked && atMax}
                  onChange={() => {
                    const next = checked ? selected.filter(v => v !== key) : [...selected, key];
                    onChange(question.id, next);
                  }}
                />
                {t(`survey.${question.id}.options.${key}`)}
              </label>
            );
          })}
        </div>
      )}

      {showOther && (
        <input
          type="text"
          className="mt-2 w-full px-4 py-2 border border-accent-200 rounded-md focus:ring-primary-500 focus:border-primary-500"
          placeholder={t('survey.wizard.otherPlaceholder')}
          value={otherValue || ''}
          onChange={e => onOtherChange(question.id, e.target.value)}
        />
      )}
    </div>
  );
};

export default SurveyQuestion;
