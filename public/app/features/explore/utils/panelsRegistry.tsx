import React from 'react';

import {
  ExplorePanelProps,
  FieldConfigSource,
  KnownVisualizationType,
  LoadingState,
  PanelProps,
  ScopedVars,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Collapse, useTheme2 } from '@grafana/ui';
// // TODO: probably needs to be exported from ui directly
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR, FilterItem } from '@grafana/ui/src/components/Table/types';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { ExploreGraph } from '../ExploreGraph';
import { ExploreGraphLabel } from '../ExploreGraphLabel';
import LogsContainer from '../LogsContainer';
import { NodeGraphContainer } from '../NodeGraphContainer';
import TableContainer from '../TableContainer';

/**
 * Based on the visualizationType try to find a specific panel instance. There are bunch of hardcoded ones but in the
 * end this will search all the installed panel and check their visualizationType to match. At this moment there
 * isn't any defined override behaviour so it's not possible to override for example table panel with custom ones
 * but this allows selecting 3rd party panels.
 * @param visualizationType
 */
export async function getPanelForVisType(visualizationType: string): Promise<React.ComponentType<ExplorePanelProps>> {
  switch (visualizationType) {
    case 'graph': {
      return GraphPanel;
    }
    case 'table': {
      return TablePanel;
    }

    case 'nodeGraph': {
      return NodeGraphPanel;
    }

    case 'logs': {
      return LogsPanel;
    }

    default: {
      const panels = getAllPanelPluginMeta();
      for (const panel of panels) {
        if (panel.visualizationType?.includes(visualizationType)) {
          const panelPlugin = await importPanelPlugin(panel.id);
          // If there is explorePanel component use that.
          if (panelPlugin.explorePanel) {
            return panelPlugin.explorePanel;
          } else if (panelPlugin.panel) {
            return makePanelExploreCompatible(panelPlugin.panel!);
          } else {
            // Not sure if this can reasonably happen. If this error out we probably catch this at a panel boundary.
            throw new Error(`Panel plugin does not define any panel component. panel.id=${panel.id}`);
          }
        }
      }
      // Probably ok fallback but maybe it makes sense to throw or show some info message that we did not find anything
      // better.
      return TablePanel;
    }
  }
}

/**
 * Wrap panel adding a transform so we can use existing dashboard panels in Explore without modification.
 * @param Panel
 */
function makePanelExploreCompatible(Panel: React.ComponentType<PanelProps>): React.ComponentType<ExplorePanelProps> {
  return function CompatibilityWrapper(props: ExplorePanelProps) {
    // This transform may not be 100% perfect so we may need to use some sensible zero/empty/noop values. We will have
    // to see how much impact that will have but I would think even if that makes some panels loose some functionality
    // it may be still ok. If there are bugs we will have to fix them somehow.
    const dashboardProps = transformToDashboardProps(props);
    return <Panel {...dashboardProps} />;
  };
}

function transformToDashboardProps(props: ExplorePanelProps): PanelProps {
  return {
    data: {
      series: props.data,
      annotations: props.annotations,
      state: props.loadingState,
      timeRange: props.range,
    },
    eventBus: props.eventBus,
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    height: 0,
    id: 0,
    onChangeTimeRange: props.onUpdateTimeRange,

    // We don't use a field config currently in Explore
    onFieldConfigChange(config: FieldConfigSource): void {
      return;
    },

    // We don't use any options currently in Explore
    onOptionsChange<TOptions>(options: TOptions): void {
      return;
    },
    // importPanelPlugin returns PanelPlugin which is basically PanelPlugin<any> so we don't know what should be
    // here but there are no options to pass in Explore
    options: undefined,
    renderCounter: 0,

    // We don't have much in sense of variables in Explore so seems like returning the string unchanged makes sense
    // there.
    replaceVariables(value: string, scopedVars: ScopedVars | undefined, format: string | Function | undefined): string {
      return value;
    },

    timeRange: props.range,
    timeZone: props.timeZone,
    title: 'explore-panel',
    transparent: false,
    width: props.width,
  };
}

// TODO: these simple wrappers can be moved to panel code and used with `setExplorePanel()` api.

function GraphPanel(props: ExplorePanelProps) {
  const {
    data,
    absoluteRange,
    timeZone,
    splitOpen,
    graphStyle,
    onChangeGraphStyle,
    annotations,
    loadingState,
    onUpdateTimeRange,
    width,
  } = props;

  const theme = useTheme2();
  const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
  const label = <ExploreGraphLabel graphStyle={graphStyle} onChangeGraphStyle={onChangeGraphStyle} />;
  return (
    <Collapse
      label={label}
      loading={loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming}
      isOpen
    >
      <ExploreGraph
        graphStyle={graphStyle}
        data={data}
        height={400}
        width={width - spacing}
        absoluteRange={absoluteRange}
        onChangeTime={onUpdateTimeRange}
        timeZone={timeZone}
        annotations={annotations}
        splitOpenFn={splitOpen}
        loadingState={loadingState}
      />
    </Collapse>
  );
}

function TablePanel(props: ExplorePanelProps) {
  const { timeZone, width, splitOpen, loadingState, onClickFilterLabel, onClickFilterOutLabel, data, range } = props;
  function onCellFilterAdded(filter: FilterItem) {
    const { value, key, operator } = filter;
    if (operator === FILTER_FOR_OPERATOR) {
      onClickFilterLabel(key, value);
    }

    if (operator === FILTER_OUT_OPERATOR) {
      onClickFilterOutLabel(key, value);
    }
  }
  return (
    <TableContainer
      data={data[0]}
      ariaLabel={selectors.pages.Explore.General.table}
      width={width}
      splitOpen={splitOpen}
      timeZone={timeZone}
      loading={loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming}
      onCellFilterAdded={onCellFilterAdded}
      range={range}
    />
  );
}

function LogsPanel(props: ExplorePanelProps) {
  const { exploreId, loadingState, width, onClickFilterLabel, onClickFilterOutLabel, onStartScanning, onStopScanning } =
    props;
  const theme = useTheme2();
  const spacing = parseInt(theme.spacing(2).slice(0, -2), 10);
  return (
    <LogsContainer
      exploreId={exploreId}
      loadingState={loadingState}
      width={width - spacing}
      onClickFilterLabel={onClickFilterLabel}
      onClickFilterOutLabel={onClickFilterOutLabel}
      onStartScanning={onStartScanning}
      onStopScanning={onStopScanning}
    />
  );
}

function NodeGraphPanel(props: ExplorePanelProps) {
  const { range, renderedVisualizations, datasourceInstance, data } = props;
  const datasourceType = datasourceInstance ? datasourceInstance?.type : 'unknown';

  return (
    <NodeGraphContainer
      dataFrames={data}
      range={range}
      withTraceView={renderedVisualizations.includes(KnownVisualizationType.trace)}
      datasourceType={datasourceType}
    />
  );
}