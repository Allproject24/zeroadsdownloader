import type { DownloadJob } from '@workspace/api-client-react';

interface ProcessLogProps {
  job: DownloadJob | null;
  active: boolean;
  clientMessages: string[];
}

export default function ProcessLog({
  job,
  active,
  clientMessages,
}: ProcessLogProps) {
  const steps = job?.steps ?? [];
  if (!active && !steps.length && !clientMessages.length) return null;

  return (
    <details
      className="process-log"
      open={active || job?.status === 'failed'}
      data-testid="panel-process-log"
    >
      <summary>
        <span>Log proses (sementara)</span>
        <span className="process-log-count">{clientMessages.length + steps.length} baris</span>
      </summary>
      <ol role="log" aria-live="polite" aria-relevant="additions">
        {clientMessages.map((message, index) => (
          <li key={`client-${index}`}>
            <span className="process-log-index">WEB</span>
            <span>{message}</span>
          </li>
        ))}
        {steps.map((step) => (
          <li key={`step-${step.id}`}>
            <span className="process-log-index">{String(step.id).padStart(2, '0')}</span>
            <span>
              {step.message}
              {step.url && <code>{step.url}</code>}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
