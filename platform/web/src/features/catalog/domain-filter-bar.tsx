import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DomainSearch } from '../../app/router';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { MultiSelect } from '../../components/common/multi-select';
import {
  booleanFilterLabel,
  businessResultFilterOptions,
  errorMechanismFilterOptions,
  mechanismFilterLabel,
  resultFilterLabel,
} from '../../shared/formatting/filter-labels';
import { useDebouncedValue } from '../../shared/hooks/use-debounced-value';

const BUSINESS_KEYS: Array<keyof DomainSearch> = ['action', 'result'];
const ERROR_KEYS: Array<keyof DomainSearch> = ['errorType', 'mechanism', 'fatal', 'handled', 'businessOnly'];

const BOOL_OPTIONS = [
  { value: 'true', label: '是' },
  { value: 'false', label: '否' },
];

export function DomainFilterBar({
  mode,
  search,
  onPatch,
  onReset,
}: {
  mode: 'business' | 'errors';
  search: DomainSearch;
  onPatch: (value: Partial<DomainSearch>, reset?: boolean) => void;
  onReset: () => void;
}) {
  const keys = mode === 'business' ? BUSINESS_KEYS : ERROR_KEYS;
  const [text, setText] = useState(mode === 'business' ? (search.action ?? '') : (search.errorType ?? ''));
  const debouncedText = useDebouncedValue(text, 300);
  const active = keys.some((key) => search[key] !== undefined);

  useEffect(() => {
    setText(mode === 'business' ? (search.action ?? '') : (search.errorType ?? ''));
  }, [mode, search.action, search.errorType]);

  useEffect(() => {
    const next = debouncedText.trim() || undefined;
    if (mode === 'business') {
      if (next !== search.action) onPatch({ action: next }, true);
    } else if (next !== search.errorType) {
      onPatch({ errorType: next }, true);
    }
  }, [debouncedText]);

  function patchList(key: 'result' | 'mechanism', values?: string[]) {
    onPatch({ [key]: values?.length ? values.join(',') : undefined } as Partial<DomainSearch>, true);
  }

  function patchBool(key: 'fatal' | 'handled', values?: string[]) {
    if (!values?.length) {
      onPatch({ [key]: undefined } as Partial<DomainSearch>, true);
      return;
    }
    // MultiSelect may pick both; last selected wins for tri-state simplicity — prefer single
    const last = values[values.length - 1];
    onPatch({ [key]: last === 'true' } as Partial<DomainSearch>, true);
  }

  return (
    <section aria-label={`${mode === 'business' ? '埋点' : '异常'}筛选`} className="border-b px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {mode === 'business' ? (
          <>
            <Input
              aria-label="Action 模糊筛选"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (!event.target.value) onPatch({ action: undefined }, true);
              }}
              onKeyDown={(event) => event.key === 'Enter' && onPatch({ action: text.trim() || undefined }, true)}
              placeholder="筛选 Action"
              className="w-56 max-w-full shrink-0"
            />
            <MultiSelect
              ariaLabel="结果"
              placeholder="结果"
              values={list(search.result)}
              options={businessResultFilterOptions}
              onChange={(values) => patchList('result', values)}
              className="w-36"
            />
          </>
        ) : (
          <>
            <Input
              aria-label="错误类型模糊筛选"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (!event.target.value) onPatch({ errorType: undefined }, true);
              }}
              onKeyDown={(event) => event.key === 'Enter' && onPatch({ errorType: text.trim() || undefined }, true)}
              placeholder="筛选错误类型"
              className="w-56 max-w-full shrink-0"
            />
            <MultiSelect
              ariaLabel="机制"
              placeholder="机制"
              values={list(search.mechanism)}
              options={errorMechanismFilterOptions}
              onChange={(values) => patchList('mechanism', values)}
              className="w-36"
            />
            <MultiSelect
              ariaLabel="致命"
              placeholder="致命"
              values={boolValues(search.fatal)}
              options={BOOL_OPTIONS}
              onChange={(values) => patchBool('fatal', values)}
              className="w-28"
            />
            <MultiSelect
              ariaLabel="已处理"
              placeholder="已处理"
              values={boolValues(search.handled)}
              options={BOOL_OPTIONS}
              onChange={(values) => patchBool('handled', values)}
              className="w-28"
            />
            <MultiSelect
              ariaLabel="仅业务失败"
              placeholder="业务失败"
              values={search.businessOnly === true ? ['true'] : undefined}
              options={[{ value: 'true', label: '仅业务失败' }]}
              onChange={(values) => onPatch({ businessOnly: values?.includes('true') || undefined }, true)}
              className="w-36"
            />
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onReset} disabled={!active}>
            <RotateCcw data-icon="inline-start" />
            重置筛选
          </Button>
        </div>
      </div>
      {active ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {keys.flatMap((key) => (
            search[key] !== undefined
              ? [<Badge key={key} variant="secondary">{domainFilterLabel(key, search[key])}</Badge>]
              : []
          ))}
        </div>
      ) : null}
    </section>
  );
}

function list(value?: string) {
  return value?.split(',').map((item) => item.trim()).filter(Boolean);
}

function boolValues(value?: boolean) {
  if (value === undefined) return undefined;
  return [String(value)];
}

function domainFilterLabel(key: keyof DomainSearch, value: unknown): string {
  if (key === 'action') return `Action: ${String(value)}`;
  if (key === 'result') return `结果: ${String(value).split(',').map(resultFilterLabel).join('、')}`;
  if (key === 'errorType') return `错误类型: ${String(value)}`;
  if (key === 'mechanism') return `机制: ${String(value).split(',').map(mechanismFilterLabel).join('、')}`;
  if (key === 'fatal') return `致命: ${booleanFilterLabel(Boolean(value))}`;
  if (key === 'handled') return `已处理: ${booleanFilterLabel(Boolean(value))}`;
  if (key === 'businessOnly') return '仅业务失败';
  return `${String(key)}: ${String(value)}`;
}
