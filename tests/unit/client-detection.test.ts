import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

import { detectClientName } from "../../src/client-detection.js";

describe("Client Detection", () => {
  let mockServer: jest.Mocked<Server>;

  beforeEach(() => {
    // Clear environment variables
    delete process.env.MCP_SOURCE;

    // Create mock server
    mockServer = {
      getClientVersion: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("MCP handshake detection", () => {
    it("should return client name as-is from handshake", () => {
      mockServer.getClientVersion.mockReturnValue({
        name: "Cursor",
        version: "0.44.0",
      });

      const result = detectClientName(mockServer);
      expect(result).toBe("cursor");
    });

    it("should return Claude Desktop name as-is", () => {
      mockServer.getClientVersion.mockReturnValue({
        name: "Claude Desktop",
        version: "1.0.0",
      });

      const result = detectClientName(mockServer);
      expect(result).toBe("claude desktop");
    });

    it("should return any client name as-is (lowercased)", () => {
      mockServer.getClientVersion.mockReturnValue({
        name: "SomeOtherClient",
        version: "1.0.0",
      });

      const result = detectClientName(mockServer);
      expect(result).toBe("someotherclient");
    });

    it("should handle missing client info gracefully", () => {
      mockServer.getClientVersion.mockReturnValue(undefined);

      const result = detectClientName(mockServer);
      expect(result).toBe("unknown");
    });

    it("should handle handshake errors gracefully", () => {
      mockServer.getClientVersion.mockImplementation(() => {
        throw new Error("Handshake not complete");
      });

      const result = detectClientName(mockServer);
      expect(result).toBe("unknown");
    });
  });

  describe("Environment variable override", () => {
    it("should prioritize MCP_SOURCE override", () => {
      const original = process.env.MCP_SOURCE;
      try {
        process.env.MCP_SOURCE = "TEST_CLIENT";
        mockServer.getClientVersion.mockReturnValue({
          name: "Cursor",
          version: "0.44.0",
        });

        const result = detectClientName(mockServer);
        expect(result).toBe("test_client");
      } finally {
        if (original) {
          process.env.MCP_SOURCE = original;
        } else {
          delete process.env.MCP_SOURCE;
        }
      }
    });
  });

  describe("Fallback behavior", () => {
    it("should return unknown when no detection methods work", () => {
      mockServer.getClientVersion.mockReturnValue(undefined);

      const result = detectClientName(mockServer);
      expect(result).toBe("unknown");
    });

    it("should work without server parameter", () => {
      const result = detectClientName();
      expect(result).toBe("unknown");
    });
  });
});
