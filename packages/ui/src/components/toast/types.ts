export type ToastType = "info" | "success" | "warning" | "error";

export type Toast = {
  id: string;
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
};

export type ShowToastOptions = {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
};

export type UseToastReturn = {
  showToast: (options: ShowToastOptions) => void;
};
