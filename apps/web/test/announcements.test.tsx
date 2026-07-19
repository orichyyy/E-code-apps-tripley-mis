import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AnnouncementForm } from "../src/features/notifications/announcement-form";
import { AnnouncementTable } from "../src/features/notifications/announcement-table";
import type {
  Announcement,
  AnnouncementOrganization,
} from "../src/features/notifications/announcement-api";

describe("announcement management components", () => {
  it("submits a minimal organization target set when a parent is selected", async () => {
    const onSubmit = vi.fn();
    render(
      <AnnouncementForm
        busy={false}
        mode="create"
        organizations={organizationTree}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Operations" } });
    fireEvent.change(screen.getByLabelText("Scope"), {
      target: { value: "organization" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /East Operations/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^Operations ops$/ }));
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Window" } });

    expect(screen.getByRole("checkbox", { name: /East Operations/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          scopeType: "organization",
          targetOrganizationIds: ["2"],
        }),
      ),
    );
  });

  it("shows only lifecycle-valid actions and all table states", () => {
    const props = tableProps();
    const { rerender } = render(
      <AnnouncementTable {...props} rows={[record("1", "draft"), record("2", "published")]} />,
    );

    expect(screen.getByRole("button", { name: "Edit announcement" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish announcement" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete announcement" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpublish announcement" })).toBeInTheDocument();

    rerender(<AnnouncementTable {...props} isLoading rows={[]} />);
    expect(screen.getByText("Loading announcements")).toBeInTheDocument();
    rerender(<AnnouncementTable {...props} isError rows={[]} />);
    expect(screen.getByText("Announcements could not be loaded.")).toBeInTheDocument();
    rerender(<AnnouncementTable {...props} rows={[]} />);
    expect(screen.getByText("No announcements match the filters.")).toBeInTheDocument();
  });
});

const organizationTree: AnnouncementOrganization[] = [
  {
    id: "2",
    name: "Operations",
    code: "ops",
    path: "72057594037927936",
    level: 1,
    status: "enabled",
    children: [
      {
        id: "3",
        name: "East Operations",
        code: "ops-east",
        path: "72339069014638592",
        level: 2,
        status: "enabled",
        children: [],
      },
    ],
  },
];

function tableProps() {
  return {
    canDelete: true,
    canPublish: true,
    canUpdate: true,
    isError: false,
    isLoading: false,
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    onPublish: vi.fn(),
    onUnpublish: vi.fn(),
  };
}

function record(id: string, status: Announcement["status"]): Announcement {
  return {
    id,
    tenantId: null,
    title: `Announcement ${id}`,
    content: "Content",
    scopeType: "system",
    targetOrganizationIds: [],
    status,
    publishedAt: status === "published" ? "2026-07-19T00:00:00.000Z" : null,
    expiresAt: null,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
    createdBy: "1",
    updatedBy: "1",
  };
}
