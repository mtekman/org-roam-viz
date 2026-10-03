// ------------------------
// Types
// ------------------------
export type GroupColor = {
  background: string;
  border: string;
};

export type GroupEntry = {
  color: GroupColor;
};

export type Groups = Record<string, GroupEntry>;

// ------------------------
// State management
// ------------------------
export class TagLegendState {
  private constructor() {}

  public static createFromNodes(nodes: any[]) {
    const tagCounts = new Map<string, number>();
    let untaggedCount = 0;

    for (const node of nodes) {
      const tags: string[] = node.nodeTags || [];
      if (tags.length === 0) {
        untaggedCount++;
      } else {
        for (const t of tags) {
          tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
        }
      }
    }

    const allTags = Array.from(tagCounts.keys()).sort();
    const enabledTags = new Set<string>(allTags);
    const untaggedEnabled = true;

    return {
      tagCounts,
      untaggedCount,
      allTags,
      enabledTags,
      untaggedEnabled,
    };
  }

  public static applyTagFilter(
    nodesDS: { get: () => any[]; update: (updates: any[]) => void },
    enabledTags: Set<string>,
    untaggedEnabled: boolean
  ): void {
    const updates: { id: any; hidden: boolean }[] = [];

    for (const node of nodesDS.get()) {
      const tags: string[] = node.nodeTags || [];

      let visible: boolean;
      if (tags.length === 0) {
        visible = untaggedEnabled;
      } else {
        visible = tags.some((t) => enabledTags.has(t));
      }

      const hidden = !visible;
      if (node.hidden !== hidden) {
        updates.push({ id: node.id, hidden });
      }
    }

    if (updates.length > 0) {
      nodesDS.update(updates);
    }
  }
}

// ------------------------
// UI building
// ------------------------
export class TagLegendUI {
  private constructor() {}

  public static build(
    legendContainerId: string,
    nodesDS: { get: () => any[]; update: (updates: any[]) => void },
    state: {
      tagCounts: Map<string, number>;
      untaggedCount: number;
      allTags: string[];
      enabledTags: Set<string>;
      untaggedEnabled: boolean;
    },
    groups: Groups
  ): void {
    const legendItemsEl = document.getElementById(legendContainerId);
    if (!legendItemsEl) return;

    const { tagCounts, untaggedCount, allTags, enabledTags } = state;
    let { untaggedEnabled } = state;

    const applyTagFilter = () => {
      TagLegendState.applyTagFilter(nodesDS, enabledTags, untaggedEnabled);
    };

    this.renderControls(legendItemsEl, allTags, enabledTags, () => {
      untaggedEnabled = true;
      for (const t of allTags) enabledTags.add(t);
      applyTagFilter();
    }, () => {
      untaggedEnabled = false;
      enabledTags.clear();
      applyTagFilter();
    });

    this.renderTagCheckboxes(
      legendItemsEl,
      allTags,
      tagCounts,
      enabledTags,
      applyTagFilter,
      groups
    );

    this.renderUntaggedCheckbox(
      legendItemsEl,
      untaggedCount,
      () => untaggedEnabled,
      (value: boolean) => {
        untaggedEnabled = value;
        applyTagFilter();
      }
    );

    this.syncSelectAllState(legendItemsEl, allTags, enabledTags, untaggedEnabled);
  }

  private static renderControls(
    container: HTMLElement,
    allTags: string[],
    enabledTags: Set<string>,
    onSelectAll: () => void,
    onDeselectAll: () => void
  ): void {
    const controlsRow = document.createElement('div');
    controlsRow.style.marginBottom = '8px';

    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.id = 'tag-select-all';
    selectAllCheckbox.checked = true;

    const selectAllLabel = document.createElement('label');
    selectAllLabel.htmlFor = selectAllCheckbox.id;
    selectAllLabel.textContent = 'Select all';
    selectAllLabel.style.marginLeft = '4px';
    selectAllLabel.style.cursor = 'pointer';

    const deselectAllCheckbox = document.createElement('input');
    deselectAllCheckbox.type = 'checkbox';
    deselectAllCheckbox.id = 'tag-deselect-all';
    deselectAllCheckbox.checked = false;

    const deselectAllLabel = document.createElement('label');
    deselectAllLabel.htmlFor = deselectAllCheckbox.id;
    deselectAllLabel.textContent = 'Deselect all';
    deselectAllLabel.style.marginLeft = '8px';
    deselectAllLabel.style.cursor = 'pointer';

    selectAllCheckbox.addEventListener('change', () => {
      if (selectAllCheckbox.checked) {
        onSelectAll();

        for (const t of allTags) {
          const cb = document.getElementById(`tag-${t}`) as HTMLInputElement | null;
          if (cb) cb.checked = true;
        }
        const untaggedCb = document.getElementById(
          'tag-__untagged__'
        ) as HTMLInputElement | null;
        if (untaggedCb) untaggedCb.checked = true;

        this.syncSelectAllState(container, allTags, enabledTags, true);
      }
    });

    deselectAllCheckbox.addEventListener('change', () => {
      if (deselectAllCheckbox.checked) {
        onDeselectAll();

        for (const t of allTags) {
          const cb = document.getElementById(`tag-${t}`) as HTMLInputElement | null;
          if (cb) cb.checked = false;
        }
        const untaggedCb = document.getElementById(
          'tag-__untagged__'
        ) as HTMLInputElement | null;
        if (untaggedCb) untaggedCb.checked = false;

        this.syncSelectAllState(container, allTags, enabledTags, false);
      }
    });

    controlsRow.appendChild(selectAllCheckbox);
    controlsRow.appendChild(selectAllLabel);
    controlsRow.appendChild(deselectAllCheckbox);
    controlsRow.appendChild(deselectAllLabel);
    container.appendChild(controlsRow);
  }

  private static renderTagCheckboxes(
    container: HTMLElement,
    allTags: string[],
    tagCounts: Map<string, number>,
    enabledTags: Set<string>,
    applyTagFilter: () => void,
    groups: Groups
  ): void {
    for (const tag of allTags) {
      const count = tagCounts.get(tag) || 0;
      const groupKey = `tag:${tag}`;
      const group = groups[groupKey];

      const row = document.createElement('div');
      row.style.marginBottom = '4px';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `tag-${tag}`;
      checkbox.checked = true;

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          enabledTags.add(tag);
        } else {
          enabledTags.delete(tag);
        }
        this.syncSelectAllStateFromContainer(container, allTags, enabledTags);
        applyTagFilter();
      });

      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.textContent = `${tag} (${count})`;
      label.style.marginLeft = '2px';
      label.style.cursor = 'pointer';

      // Apply color from groups if present
      if (group?.color?.background) {
        label.style.color = group.color.background;
        label.style.fontWeight = '100';
      }
      row.appendChild(checkbox);
      row.appendChild(label);
      container.appendChild(row);
    }
  }

  private static renderUntaggedCheckbox(
    container: HTMLElement,
    untaggedCount: number,
    getUntaggedEnabled: () => boolean,
    setUntaggedEnabled: (value: boolean) => void
  ): void {
    if (untaggedCount === 0) return;

    const row = document.createElement('div');
    row.style.marginBottom = '4px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'tag-__untagged__';
    checkbox.checked = true;

    checkbox.addEventListener('change', () => {
      setUntaggedEnabled(checkbox.checked);
      this.syncSelectAllStateForUntagged(container, checkbox.checked);
    });

    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = `untagged (${untaggedCount})`;
    label.style.marginLeft = '4px';
    label.style.cursor = 'pointer';

    row.appendChild(checkbox);
    row.appendChild(label);
    container.appendChild(row);
  }

  private static syncSelectAllState(
    container: HTMLElement,
    allTags: string[],
    enabledTags: Set<string>,
    untaggedEnabled: boolean
  ): void {
    const selectAllCheckbox = document.getElementById(
      'tag-select-all'
    ) as HTMLInputElement | null;
    const deselectAllCheckbox = document.getElementById(
      'tag-deselect-all'
    ) as HTMLInputElement | null;
    if (!selectAllCheckbox || !deselectAllCheckbox) return;

    const allRealTagsSelected =
      allTags.length > 0 &&
      allTags.every((t) => enabledTags.has(t));

    const noRealTagsSelected =
      allTags.length === 0 ||
      allTags.every((t) => !enabledTags.has(t));

    selectAllCheckbox.checked = allRealTagsSelected && untaggedEnabled;
    deselectAllCheckbox.checked = noRealTagsSelected && !untaggedEnabled;
  }

  private static syncSelectAllStateFromContainer(
    container: HTMLElement,
    allTags: string[],
    enabledTags: Set<string>
  ): void {
    const selectAllCheckbox = container.querySelector(
      '#tag-select-all'
    ) as HTMLInputElement | null;
    const deselectAllCheckbox = container.querySelector(
      '#tag-deselect-all'
    ) as HTMLInputElement | null;
    const untaggedCb = container.querySelector(
      '#tag-__untagged__'
    ) as HTMLInputElement | null;

    if (!selectAllCheckbox || !deselectAllCheckbox) return;

    const untaggedEnabled = untaggedCb ? untaggedCb.checked : false;

    const allRealTagsSelected =
      allTags.length > 0 &&
      allTags.every((t) => enabledTags.has(t));

    const noRealTagsSelected =
      allTags.length === 0 ||
      allTags.every((t) => !enabledTags.has(t));

    selectAllCheckbox.checked = allRealTagsSelected && untaggedEnabled;
    deselectAllCheckbox.checked = noRealTagsSelected && !untaggedEnabled;
  }

  private static syncSelectAllStateForUntagged(
    container: HTMLElement,
    untaggedEnabled: boolean
  ): void {
    const selectAllCheckbox = container.querySelector(
      '#tag-select-all'
    ) as HTMLInputElement | null;
    const deselectAllCheckbox = container.querySelector(
      '#tag-deselect-all'
    ) as HTMLInputElement | null;
    if (!selectAllCheckbox || !deselectAllCheckbox) return;

    const allTagsCheckboxes = container.querySelectorAll<HTMLInputElement>('input[id^="tag-"]');
    const realTagIds = Array.from(allTagsCheckboxes)
      .map((cb) => cb.id)
      .filter(
        (id) =>
          id !== 'tag-select-all' &&
          id !== 'tag-deselect-all' &&
          id !== 'tag-__untagged__'
      )
      .map((id) => id.replace('tag-', ''));

    const enabledTags = new Set<string>(
      realTagIds.filter((t) => {
        const cb = document.getElementById(`tag-${t}`) as HTMLInputElement | null;
        return cb ? cb.checked : false;
      })
    );

    const allRealTagsSelected =
      realTagIds.length > 0 &&
      realTagIds.every((t) => enabledTags.has(t));

    const noRealTagsSelected =
      realTagIds.length === 0 ||
      realTagIds.every((t) => !enabledTags.has(t));

    selectAllCheckbox.checked = allRealTagsSelected && untaggedEnabled;
    deselectAllCheckbox.checked = noRealTagsSelected && !untaggedEnabled;
  }
}

export default class TagLegend {
  private constructor() {}

  /**
   * Build the tag legend UI for the given container and data source.
   * Call once at initialization.
   *
   * groups: object like:
   * {
   *   default: { color: { background: '#...', border: '#...' } },
   *   'tag:cream': { color: { background: '#...', border: '#...' } },
   *   ...
   * }
   */
  public static init(
    nodesDS: { get: () => any[]; update: (updates: any[]) => void },
    legendContainerId: string,
    groups: Groups
  ): void {
    const nodes = nodesDS.get();
    const state = TagLegendState.createFromNodes(nodes);
    TagLegendUI.build(legendContainerId, nodesDS, state, groups);
  }
}