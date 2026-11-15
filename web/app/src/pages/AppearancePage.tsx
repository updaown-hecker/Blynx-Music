import { PageHeader } from '@/components/PageHeader';
import { isMobileBrowser } from '@/lib/platform';
import { AppearanceSettings } from './AppearanceSettings';
import { CustomCssEditor } from './CustomCssEditor';
import { settingsUi } from './settingsStyles';

export default function AppearancePage() {
  return (
    <div className={settingsUi.centered}>
      <PageHeader title="Appearance" back={{ to: '/settings', label: 'Settings' }} />
      <div className={settingsUi.body}>
        <AppearanceSettings />
        {!isMobileBrowser() && <>
          <h2 className={settingsUi.sectionHeader}>Custom CSS</h2>
          <CustomCssEditor />
        </>}
      </div>
    </div>
  );
}
