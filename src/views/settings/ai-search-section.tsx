import { AiProviderSettings } from "@/lib/mutiny/ai-provider-settings";
import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import jinaLogo from "@/assets/ai-logos/jina.png";
import keenableLogo from "@/assets/ai-logos/keenable.png";
import { Globe } from "./icons";
import { ExtLink, KeyField, Section, Segmented, ToggleRow } from "./shared";
import { SettingRow } from "./kit";

/** Provider credentials remain independent; live-web settings apply to every service. */
export function AiSearchSection() {
  const { settings, update } = useSettings();
  const t = useT();
  const [jinaDraft, setJinaDraft] = useState(settings.jinaKey);
  const [keenableDraft, setKeenableDraft] = useState(settings.keenableKey);
  const keenable = settings.aiWebSource === "keenable";
  return (
    <>
      <Section title={t("AI search")}><AiProviderSettings /></Section>
      <Section title={t("Live web")}>
        {keenable ? (
          <SettingRow
            wide
            icon={<Globe size={18} strokeWidth={2} />}
            label="Keenable"
            desc={
              <span>
                {t(
                  "Augments AI picks with current web results before asking the model. Powered by",
                )}{" "}
                <ExtLink href="https://keenable.ai">Keenable</ExtLink>.
              </span>
            }
          />
        ) : (
          <SettingRow
            wide
            icon={<Globe size={18} strokeWidth={2} />}
            label="Jina Reader"
            desc={
              <span>
                {t(
                  "Augments AI picks with current web results before asking the model. Powered by",
                )}{" "}
                <ExtLink href="https://jina.ai/reader">Jina Reader</ExtLink>.
              </span>
            }
          />
        )}
        <ToggleRow
          label={t("Use live web context")}
          sub={t("Searches the web and feeds context into the chosen AI model.")}
          value={settings.aiWebSearch}
          onChange={(v) => update({ aiWebSearch: v })}
        />
        <SettingRow label={t("Search source")}>
          <Segmented
            value={settings.aiWebSource}
            onChange={(v) => update({ aiWebSource: v })}
            options={[
              { value: "jina", label: "Jina Reader" },
              { value: "keenable", label: "Keenable" },
            ]}
          />
        </SettingRow>
        {keenable ? (
          <KeyField
            label={t("Keenable API key (optional)")}
            placeholder={t("API key")}
            iconSrc={keenableLogo}
            value={keenableDraft}
            onChange={setKeenableDraft}
            onSave={() => update({ keenableKey: keenableDraft.trim() })}
            saved={false}
            help={
              <span>
                <ExtLink href="https://keenable.ai/console">Keenable</ExtLink> search credentials
                are optional and separate from the AI model provider.
              </span>
            }
          />
        ) : (
          <KeyField
            label={t("Jina API key (optional)")}
            placeholder={t("jina_...")}
            iconSrc={jinaLogo}
            value={jinaDraft}
            onChange={setJinaDraft}
            onSave={() => update({ jinaKey: jinaDraft.trim() })}
            saved={false}
            help={
              <span>
                <ExtLink href="https://jina.ai/reader">Jina Reader</ExtLink> search credentials are
                optional and separate from the AI model provider.
              </span>
            }
          />
        )}
      </Section>
    </>
  );
}
