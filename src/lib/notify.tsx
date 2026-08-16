import type { ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import { Check, CircleAlert, Info, TriangleAlert } from 'lucide-react';

type NotifyOpts = {
  title?: string;
  autoClose?: number | false;
};

function show(color: string, icon: ReactNode, message: string, opts?: NotifyOpts) {
  notifications.show({
    title: opts?.title,
    message,
    color,
    icon,
    autoClose: opts?.autoClose ?? 4500,
    withCloseButton: true,
    radius: 'md',
  });
}

export function notifySuccess(message: string, opts?: NotifyOpts) {
  show('teal', <Check size={16} />, message, { title: 'Success', ...opts });
}

export function notifyError(message: string, opts?: NotifyOpts) {
  show('red', <CircleAlert size={16} />, message, { title: 'Error', autoClose: 7000, ...opts });
}

export function notifyWarning(message: string, opts?: NotifyOpts) {
  show('orange', <TriangleAlert size={16} />, message, { title: 'Notice', autoClose: 6000, ...opts });
}

export function notifyInfo(message: string, opts?: NotifyOpts) {
  show('indigo', <Info size={16} />, message, { title: 'Update', ...opts });
}
