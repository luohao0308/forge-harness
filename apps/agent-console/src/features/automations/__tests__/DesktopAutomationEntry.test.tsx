import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { DesktopWorkspaceMenu } from "../../../components/desktop/DesktopWorkspaceMenu";

describe("Desktop automation entry", () => {
  it("keeps Automations in the contextual workspace menu and marks it active", () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/agents?desktop_panel=triggers&return_to=%2Fagents%2Fdefault%2Fworkspace",
        ]}
      >
        <DesktopWorkspaceMenu />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "工作台工具" }));
    const entry = screen.getByRole("menuitem", { name: "自动化" });
    expect(entry).toHaveAttribute(
      "href",
      "/agents?desktop_panel=triggers&return_to=%2Fagents%2Fdefault%2Fworkspace",
    );
    expect(entry).toHaveAttribute("aria-current", "page");
  });
});
