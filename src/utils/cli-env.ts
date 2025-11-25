export function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test";
}

type Spinner = {
  start: (msg?: string) => void;
  stop: () => void;
  succeed: (msg?: string) => void;
  fail: (msg?: string) => void;
};

export async function getSpinner(): Promise<Spinner> {
  if (isTestEnv()) {
    return {
      start: () => {},
      stop: () => {},
      succeed: () => {},
      fail: () => {},
    };
  }
  try {
    const ora = (await import("ora")).default;
    return ora();
  } catch {
    return {
      start: () => {},
      stop: () => {},
      succeed: () => {},
      fail: () => {},
    };
  }
}

export async function loadUi(): Promise<any> {
  if (isTestEnv()) {
    return {
      createTable: () => ({ push: () => {}, toString: () => "" }),
      formatKeyValue: (_k: string, v: string, _c?: any) => v,
      icons: { key: "", globe: "", zap: "", lock: "", bulb: "", fire: "" },
      showBox: () => {},
      showError: () => {},
      showInfo: () => {},
      showIterableLogo: () => {},
      showSection: () => {},
      showSuccess: () => {},
      linkColor: () => (s: string) => s,
    };
  }
  return await import("./ui.js");
}
