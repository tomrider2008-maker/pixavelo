import { Check, ChevronDown, Cpu, ShieldCheck } from 'lucide-react';
import { advancedInputCapabilities } from '../../engine/codecs/inputCapabilities';

export function AdvancedFormatCapabilities() {
  const native = advancedInputCapabilities.filter((item) => !item.loadedOnDemand);
  const lazy = advancedInputCapabilities.filter((item) => item.loadedOnDemand);

  return (
    <details className="format-capabilities">
      <summary>
        <Cpu size={16} aria-hidden="true" />
        <span>Input capabilities</span>
        <small>8 advanced formats</small>
        <ChevronDown className="format-capabilities__chevron" size={15} aria-hidden="true" />
      </summary>
      <div className="format-capabilities__panel">
        <header>
          <strong>Advanced input support</strong>
          <small>Outputs remain JPEG, PNG or WebP.</small>
        </header>
        <CapabilityGroup title="Browser decoder · verified per file" items={native} />
        <CapabilityGroup title="Local codec · loaded on demand" items={lazy} />
        <p>
          <ShieldCheck size={14} aria-hidden="true" /> No source file leaves this device.
        </p>
      </div>
    </details>
  );
}

function CapabilityGroup({
  title,
  items
}: {
  readonly title: string;
  readonly items: readonly (typeof advancedInputCapabilities)[number][];
}) {
  return (
    <section>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.format} title={item.detail}>
            <Check size={14} aria-hidden="true" /> {item.formatLabel}
          </li>
        ))}
      </ul>
    </section>
  );
}
