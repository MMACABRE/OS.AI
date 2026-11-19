import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { Button, Dialog, List } from '@hsos/ui-kit';
import { useHudDeps } from './hud-context';
import { useHudData } from './hud-data';
import styles from './Hud.module.css';

/** The test line of HUD-16. */
export const TEST_LINE = 'This is how HSOS alerts sound.';
const DEFAULT_VOICE = 'Windows default';

/** Opened by `hud.chooseVoice`. */
export const useVoiceChooser = create<{ open: boolean }>(() => ({ open: false }));

/** The voice dialog of HUD-16: "Windows default", then the voices Windows has, the current one selected. */
export function VoiceChooser() {
  const deps = useHudDeps();
  const open = useVoiceChooser((state) => state.open);
  const settings = useHudData((state) => state.settings);
  const [voices, setVoices] = useState<readonly string[]>([]);
  const [selected, setSelected] = useState<string>(settings.speakVoice === '' ? DEFAULT_VOICE : settings.speakVoice);
  useEffect(() => {
    if (!open) return;
    setSelected(settings.speakVoice === '' ? DEFAULT_VOICE : settings.speakVoice);
    void deps.bus.call(shellChannels.listVoices, {}).then((result) => setVoices(result.ok ? result.value : []));
  }, [open, deps.bus, settings.speakVoice]);
  if (!open) return null;
  const close = () => useVoiceChooser.setState({ open: false });
  const choose = (name: string) => {
    const voice = name === DEFAULT_VOICE ? '' : name;
    void deps.setSetting('speakVoice', voice);
    void deps.bus.call(shellChannels.speak, { text: TEST_LINE, voice: voice === '' ? null : voice, rate: settings.speakRate });
    close();
  };
  const rows = [DEFAULT_VOICE, ...voices].map((name) => ({ id: name, text: name }));
  return (
    <Dialog title="Alert voice" onClose={close} actions={<Button onPress={close}>Cancel</Button>}>
      <div className={styles.popover}>
        <List
          rows={rows}
          rowHeight={26}
          label="Voices"
          selectedId={selected}
          onSelect={setSelected}
          onActivate={choose}
          renderRow={(row) => row.text}
        />
        <Button variant="primary" onPress={() => choose(selected)}>
          Use this voice
        </Button>
      </div>
    </Dialog>
  );
}
