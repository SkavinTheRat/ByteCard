import { Linking } from 'react-native';
import { ConfirmSheet } from './ConfirmSheet';
import { OptionSheet } from './OptionSheet';
import type { LimitSelector } from './MeLearningSettings';
import { zh } from '@/i18n/zh';

type Props = {
  selector: LimitSelector | null;
  resetOpen: boolean;
  permissionOpen: boolean;
  reminderGuideOpen: boolean;
  onSelectorClose: () => void;
  onSelectLimit: (value: number) => void;
  onResetClose: () => void;
  onResetConfirm: () => void;
  onPermissionClose: () => void;
  onReminderGuideClose: () => void;
};

export function MeScreenSheets({
  selector,
  resetOpen,
  permissionOpen,
  reminderGuideOpen,
  onSelectorClose,
  onSelectLimit,
  onResetClose,
  onResetConfirm,
  onPermissionClose,
  onReminderGuideClose,
}: Props) {
  return (
    <>
      <OptionSheet
        onClose={onSelectorClose}
        onSelect={onSelectLimit}
        options={selector?.options ?? []}
        selected={selector?.value ?? 0}
        title={selector?.title ?? ''}
        visible={selector !== null}
      />
      <ConfirmSheet
        confirmLabel={zh.me.resetConfirm}
        message={zh.me.resetMessage}
        onClose={onResetClose}
        onConfirm={onResetConfirm}
        title={zh.me.resetTitle}
        visible={resetOpen}
      />
      <ConfirmSheet
        confirmLabel={zh.reminder.openSettings}
        message={zh.reminder.permissionBody}
        onClose={onPermissionClose}
        onConfirm={() => {
          onPermissionClose();
          void Linking.openSettings();
        }}
        title={zh.reminder.permissionTitle}
        visible={permissionOpen}
      />
      <ConfirmSheet
        confirmLabel={zh.common.close}
        message={zh.reminder.guideBody}
        onClose={onReminderGuideClose}
        onConfirm={onReminderGuideClose}
        title={zh.reminder.guideTitle}
        visible={reminderGuideOpen}
      />
    </>
  );
}
