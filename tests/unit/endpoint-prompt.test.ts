/* eslint-disable simple-import-sort/imports */
import { describe, expect, it } from "@jest/globals";
import { promptForIterableBaseUrl } from "../../src/utils/endpoint-prompt";

function makeInquirerQueue(results: any[]) {
  return { prompt: jest.fn(async () => results.shift()) };
}

const chalkMock = { yellow: (s: string) => s } as any;
const iconsMock = { globe: "" } as any;

describe("promptForIterableBaseUrl", () => {
  it("returns US endpoint when selected", async () => {
    const inquirer = makeInquirerQueue([{ endpointChoice: "us" }]);
    const url = await promptForIterableBaseUrl({
      inquirer,
      icons: iconsMock,
      chalk: chalkMock,
      showError: () => {},
    });
    expect(url).toBe("https://api.iterable.com");
  });

  it("returns EU endpoint when selected", async () => {
    const inquirer = makeInquirerQueue([{ endpointChoice: "eu" }]);
    const url = await promptForIterableBaseUrl({
      inquirer,
      icons: iconsMock,
      chalk: chalkMock,
      showError: () => {},
    });
    expect(url).toBe("https://api.eu.iterable.com");
  });

  it("accepts custom https domain with confirmation", async () => {
    const inquirer = makeInquirerQueue([
      { endpointChoice: "custom" },
      { customUrl: "https://example.com" },
      { confirmCustom: true },
    ]);
    const url = await promptForIterableBaseUrl({
      inquirer,
      icons: iconsMock,
      chalk: chalkMock,
      showError: () => {},
    });
    expect(url).toBe("https://example.com");
  });

  it("rejects custom http non-local host", async () => {
    const errors: string[] = [];
    const inquirer = makeInquirerQueue([
      { endpointChoice: "custom" },
      { customUrl: "http://evil.com" },
    ]);
    await expect(
      promptForIterableBaseUrl({
        inquirer,
        icons: iconsMock,
        chalk: chalkMock,
        showError: (m: string) => errors.push(m),
      })
    ).rejects.toBeTruthy();
    expect(errors.join(" ")).toMatch(/HTTP is not allowed/i);
  });

  it("allows custom http localhost", async () => {
    const inquirer = makeInquirerQueue([
      { endpointChoice: "custom" },
      { customUrl: "http://localhost:3000" },
    ]);
    const url = await promptForIterableBaseUrl({
      inquirer,
      icons: iconsMock,
      chalk: chalkMock,
      showError: () => {},
    });
    expect(url).toBe("http://localhost:3000");
  });

  it("cancels when non-Iterable https not confirmed", async () => {
    const errors: string[] = [];
    const inquirer = makeInquirerQueue([
      { endpointChoice: "custom" },
      { customUrl: "https://example.com" },
      { confirmCustom: false },
    ]);
    await expect(
      promptForIterableBaseUrl({
        inquirer,
        icons: iconsMock,
        chalk: chalkMock,
        showError: (m: string) => errors.push(m),
      })
    ).rejects.toBeTruthy();
    expect(errors.join(" ")).toMatch(/Custom endpoint not confirmed/i);
  });
});
