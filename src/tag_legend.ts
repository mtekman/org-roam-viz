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

export type NodesDataSource = {
  get: () => any[];
  update: (updates: any[]) => void;
};

export type TagLegendFilterState = {
  enabledTags: Set<string>;
  untaggedEnabled: boolean;
  minMembers: number;
  maxMembers: number;
};

export type TagLegendStateData = {
  tagCounts: Map<string, number>;
  untaggedCount: number;
  allTags: string[];
  filter: TagLegendFilterState;
};

// ------------------------
// State management
// ------------------------
export class TagLegendState {
  private constructor() {}

  public static createFromNodes(nodes: any[]): TagLegendStateData {
    const tagCounts = new Map<string, number>();
    let untaggedCount = 0;

    for (const node of nodes) {
      const tags: string[] = node.nodeTags || [];

      if (tags.length === 0) {
        untaggedCount++;
      } else {
        for (const tag of tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
    }

    const allTags = Array.from(tagCounts.keys()).sort();

    const maxMemberCount = this.getMaxMemberCount(
      tagCounts,
      allTags,
      untaggedCount
    );

    return {
      tagCounts,
      untaggedCount,
      allTags,
      filter: {
        enabledTags: new Set<string>(allTags),
        untaggedEnabled: true,
        minMembers: 1,
        maxMembers: maxMemberCount,
      },
    };
  }

  public static getMaxMemberCount(
    tagCounts: Map<string, number>,
    allTags: string[],
    untaggedCount: number
  ): number {
    return Math.max(
      1,
      ...allTags.map((tag) => tagCounts.get(tag) || 0),
      untaggedCount
    );
  }

  public static getVisibleTags(
    tagCounts: Map<string, number>,
    allTags: string[],
    filter: TagLegendFilterState
  ): string[] {
    return allTags.filter((tag) => {
      const count = tagCounts.get(tag) || 0;

      return (
        count >= filter.minMembers &&
        count <= filter.maxMembers
      );
    });
  }

  public static applyTagFilter(
    nodesDS: NodesDataSource,
    tagCounts: Map<string, number>,
    filter: TagLegendFilterState
  ): void {
    const updates: { id: any; hidden: boolean }[] = [];

    for (const node of nodesDS.get()) {
      const tags: string[] = node.nodeTags || [];

      let visible: boolean;

      if (tags.length === 0) {
        visible = filter.untaggedEnabled;
      } else {
        visible = tags.some((tag) => {
          const count = tagCounts.get(tag) || 0;

          return (
            filter.enabledTags.has(tag) &&
            count >= filter.minMembers &&
            count <= filter.maxMembers
          );
        });
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
    nodesDS: NodesDataSource,
    state: TagLegendStateData,
    groups: Groups
  ): void {
    const legendEl = document.getElementById(legendContainerId);
    if (!legendEl) return;

    legendEl.innerHTML = '';
    legendEl.classList.add('tag-legend-cloud');

    const {
      tagCounts,
      untaggedCount,
      allTags,
      filter,
    } = state;

    const absoluteMax = TagLegendState.getMaxMemberCount(
      tagCounts,
      allTags,
      untaggedCount
    );

    filter.minMembers = Math.min(
      Math.max(1, filter.minMembers || 1),
      absoluteMax
    );

    filter.maxMembers = Math.min(
      Math.max(filter.minMembers, filter.maxMembers || absoluteMax),
      absoluteMax
    );

    const applyFilter = () => {
      TagLegendState.applyTagFilter(
        nodesDS,
        tagCounts,
        filter
      );
    };

    this.renderRangeControl(
      legendEl,
      state,
      groups,
      absoluteMax,
      applyFilter
    );

    this.renderCloud(
      legendEl,
      state,
      groups,
      applyFilter
    );

    applyFilter();
  }

  private static renderRangeControl(
    legendEl: HTMLElement,
    state: TagLegendStateData,
    groups: Groups,
    absoluteMax: number,
    applyFilter: () => void
  ): void {
    const { filter } = state;

    const controls = document.createElement('div');
    controls.className = 'tag-legend-controls';

    const rangeLabel = document.createElement('label');
    rangeLabel.textContent = 'Members:';
    rangeLabel.style.marginRight = '8px';

    const rangeWrapper = document.createElement('div');
    rangeWrapper.className = 'dual-range';

    const rangeTrack = document.createElement('div');
    rangeTrack.className = 'dual-range-track';

    const rangeFill = document.createElement('div');
    rangeFill.className = 'dual-range-fill';

    const minRange = document.createElement('input');
    minRange.type = 'range';
    minRange.className = 'range-min';
    minRange.min = '1';
    minRange.max = String(absoluteMax);
    minRange.step = '1';
    minRange.value = String(filter.minMembers);
    minRange.setAttribute('aria-label', 'Minimum number of members');

    const maxRange = document.createElement('input');
    maxRange.type = 'range';
    maxRange.className = 'range-max';
    maxRange.min = '1';
    maxRange.max = String(absoluteMax);
    maxRange.step = '1';
    maxRange.value = String(filter.maxMembers);
    maxRange.setAttribute('aria-label', 'Maximum number of members');

    const rangeValue = document.createElement('span');
    rangeValue.className = 'dual-range-value';

    const renderCloudForRange = () => {
      this.renderCloud(
        legendEl,
        state,
        groups,
        applyFilter
      );
    };

    const updateRangeUI = () => {
      const denominator = Math.max(1, absoluteMax - 1);

      const minPercent =
        ((filter.minMembers - 1) / denominator) * 100;

      const maxPercent =
        ((filter.maxMembers - 1) / denominator) * 100;

      rangeFill.style.left = `${minPercent}%`;
      rangeFill.style.width = `${Math.max(
        0,
        maxPercent - minPercent
      )}%`;

      rangeValue.textContent =
        `${filter.minMembers}–${filter.maxMembers}`;
    };

    minRange.addEventListener('input', () => {
      const parsed = Number.parseInt(minRange.value, 10);
      const nextMin = Number.isFinite(parsed) ? parsed : 1;

      filter.minMembers = Math.min(
        Math.max(1, nextMin),
        filter.maxMembers
      );

      minRange.value = String(filter.minMembers);

      updateRangeUI();
      renderCloudForRange();
      applyFilter();
    });

    maxRange.addEventListener('input', () => {
      const parsed = Number.parseInt(maxRange.value, 10);
      const nextMax = Number.isFinite(parsed) ? parsed : absoluteMax;

      filter.maxMembers = Math.max(
        Math.min(absoluteMax, nextMax),
        filter.minMembers
      );

      maxRange.value = String(filter.maxMembers);

      updateRangeUI();
      renderCloudForRange();
      applyFilter();
    });

    rangeWrapper.appendChild(rangeTrack);
    rangeWrapper.appendChild(rangeFill);
    rangeWrapper.appendChild(minRange);
    rangeWrapper.appendChild(maxRange);

    controls.appendChild(rangeLabel);
    controls.appendChild(rangeWrapper);
    controls.appendChild(rangeValue);

    legendEl.appendChild(controls);

    updateRangeUI();
  }

  private static renderCloud(
    legendEl: HTMLElement,
    state: TagLegendStateData,
    groups: Groups,
    applyFilter: () => void
  ): void {
    const existingCloud = legendEl.querySelector('.tag-cloud-items');

    if (existingCloud) {
      existingCloud.remove();
    }

    const {
      tagCounts,
      untaggedCount,
      allTags,
      filter,
    } = state;

    const visibleTags = TagLegendState.getVisibleTags(
      tagCounts,
      allTags,
      filter
    );

    const isUntaggedVisible =
      untaggedCount >= filter.minMembers &&
      untaggedCount <= filter.maxMembers;

    const maxCount = Math.max(
      1,
      ...visibleTags.map((tag) => tagCounts.get(tag) || 0),
      isUntaggedVisible ? untaggedCount : 0
    );

    const cloud = document.createElement('div');
    cloud.className = 'tag-cloud-items';

    const createTagButton = (
      tag: string,
      count: number,
      isEnabled: boolean,
      onToggle: (enabled: boolean) => void,
      color?: string
    ) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tag-cloud-item';
      button.dataset.tag = tag;
      button.setAttribute('aria-pressed', String(isEnabled));
      button.textContent = `${tag} (${count})`;

      const ratio = count / maxCount;
      const fontSize = 9 + ratio * 12;

      button.style.fontSize = `${fontSize.toFixed(1)}px`;

      if (color) {
        button.style.setProperty('--tag-color', color);
      }

      this.setButtonState(button, isEnabled, color);

      button.addEventListener('click', () => {
        const nextEnabled =
          button.getAttribute('aria-pressed') !== 'true';

        button.setAttribute('aria-pressed', String(nextEnabled));
        this.setButtonState(button, nextEnabled, color);

        onToggle(nextEnabled);
        applyFilter();
      });

      return button;
    };

    for (const tag of visibleTags) {
      const count = tagCounts.get(tag) || 0;
      const group = groups[`tag:${tag}`];
      const color = group?.color?.background;

      cloud.appendChild(
        createTagButton(
          tag,
          count,
          filter.enabledTags.has(tag),
          (isEnabled) => {
            if (isEnabled) {
              filter.enabledTags.add(tag);
            } else {
              filter.enabledTags.delete(tag);
            }
          },
          color
        )
      );
    }

    if (isUntaggedVisible) {
      const untaggedButton = createTagButton(
        'untagged',
        untaggedCount,
        filter.untaggedEnabled,
        (isEnabled) => {
          filter.untaggedEnabled = isEnabled;
        }
      );

      untaggedButton.dataset.tag = '__untagged__';
      cloud.appendChild(untaggedButton);
    }

    legendEl.appendChild(cloud);
  }

  private static setButtonState(
    button: HTMLButtonElement,
    isEnabled: boolean,
    color?: string
  ): void {
    button.classList.toggle('is-enabled', isEnabled);
    button.classList.toggle('is-disabled', !isEnabled);

    if (color) {
      button.style.color = '';
      button.style.backgroundColor = isEnabled ? color : '';
    }
  }
}

// ------------------------
// Public API
// ------------------------
export default class TagLegend {
  private constructor() {}

  public static init(
    nodesDS: NodesDataSource,
    legendContainerId: string,
    groups: Groups
  ): void {
    const nodes = nodesDS.get();
    const state = TagLegendState.createFromNodes(nodes);

    TagLegendUI.build(legendContainerId, nodesDS, state, groups);
  }
}