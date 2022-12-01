import { css } from '@emotion/css';
import { dump } from 'js-yaml';
import { keyBy } from 'lodash';
import Prism from 'prismjs';
import React, { useEffect } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data/src';
import { Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime/src';
import { useStyles2 } from '@grafana/ui/src';
import { mapRelativeTimeRangeToOption } from '@grafana/ui/src/components/DateTimePickers/RelativeTimeRangePicker/utils';

import { AlertQuery, RulerGrafanaRuleDTO } from '../../../types/unified-alerting-dto';
import { isExpressionQuery } from '../../expressions/guards';
import {
  downsamplingTypes,
  ExpressionQuery,
  ExpressionQueryType,
  reducerMode,
  reducerTypes,
  thresholdFunctions,
  upsamplingTypes,
} from '../../expressions/types';
import alertDef, { EvalFunction } from '../state/alertDef';

export function GrafanaRuleViewer({ rule }: { rule: RulerGrafanaRuleDTO }) {
  // const styles = useStyles2(getGrafanaRuleViewerStyles);

  const dsByUid = keyBy(Object.values(config.datasources), (ds) => ds.uid);

  useEffect(() => {
    Prism.highlightAll();
  });

  const queries = rule.grafana_alert.data.filter((q) => !isExpressionQuery(q.model));
  const expressions = rule.grafana_alert.data.filter((q) => isExpressionQuery(q.model));

  return (
    <Stack gap={2} direction="column">
      <Stack gap={2}>
        {queries.map(({ model, relativeTimeRange, refId, datasourceUid }, index) => {
          const dataSource = dsByUid[datasourceUid];

          return (
            <QueryPreview
              key={index}
              refId={refId}
              model={model}
              relativeTimeRange={relativeTimeRange}
              dataSource={dataSource}
            />
          );
        })}
      </Stack>

      <Stack gap={1}>
        {expressions.map(({ model, relativeTimeRange, refId, datasourceUid }, index) => {
          const dataSource = dsByUid[datasourceUid];

          return (
            isExpressionQuery(model) && (
              <ExpressionPreview key={index} refId={refId} model={model} dataSource={dataSource} />
            )
          );
        })}
      </Stack>
    </Stack>
  );
}

// const getGrafanaRuleViewerStyles = (theme: GrafanaTheme2) => ({});

interface QueryPreviewProps extends Pick<AlertQuery, 'refId' | 'relativeTimeRange' | 'model'> {
  dataSource?: DataSourceInstanceSettings;
}

function QueryPreview({ refId, relativeTimeRange, model, dataSource }: QueryPreviewProps) {
  const styles = useStyles2(getQueryPreviewStyles);

  const headerItems = [dataSource?.name ?? '[[Data source not found]]'];
  if (relativeTimeRange) {
    headerItems.push(mapRelativeTimeRangeToOption(relativeTimeRange).display);
  }

  return (
    <QueryBox refId={refId} headerItems={headerItems}>
      <pre className={styles.code}>
        <code>{dump(model)}</code>
      </pre>
    </QueryBox>
  );
}

const getQueryPreviewStyles = (theme: GrafanaTheme2) => ({
  code: css`
    margin: ${theme.spacing(1)};
  `,
});

interface ExpressionPreviewProps extends Pick<AlertQuery, 'refId'> {
  model: ExpressionQuery;
  dataSource: DataSourceInstanceSettings;
}

function ExpressionPreview({ refId, model }: ExpressionPreviewProps) {
  function renderPreview() {
    switch (model.type) {
      case ExpressionQueryType.math:
        return (
          <QueryBox refId={refId} headerItems={['Math']}>
            <MathExpressionViewer model={model} />
          </QueryBox>
        );

      case ExpressionQueryType.reduce:
        return (
          <QueryBox refId={refId} headerItems={['Reduce']}>
            <ReduceConditionViewer model={model} />
          </QueryBox>
        );

      case ExpressionQueryType.resample:
        return (
          <QueryBox refId={refId} headerItems={['Resample']}>
            <ResampleExpressionViewer model={model} />
          </QueryBox>
        );

      case ExpressionQueryType.classic:
        return (
          <QueryBox refId={refId} headerItems={['Classic condition']}>
            <ClassicConditionViewer model={model} />
          </QueryBox>
        );

      case ExpressionQueryType.threshold:
        return (
          <QueryBox refId={refId} headerItems={['Threshold']}>
            <ThresholdExpressionViewer model={model} />
          </QueryBox>
        );

      default:
        return <>Expression not supported: {model.type}</>;
    }
  }

  return <>{renderPreview()}</>;
}

interface QueryBoxProps extends React.PropsWithChildren<unknown> {
  refId: string;
  headerItems?: string[];
}

function QueryBox({ refId, headerItems = [], children }: QueryBoxProps) {
  const styles = useStyles2(getQueryBoxStyles);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span className={styles.refId}>{refId}</span>
        {headerItems.map((item, index) => (
          <span key={index} className={styles.textBlock}>
            {item}
          </span>
        ))}
      </header>
      {children}
    </div>
  );
}

const getQueryBoxStyles = (theme: GrafanaTheme2) => ({
  container: css`
    border: 1px solid ${theme.colors.border.strong};
  `,
  header: css`
    display: flex;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(1)};
    background-color: ${theme.colors.background.secondary};
  `,
  textBlock: css`
    border: 1px solid ${theme.colors.border.weak};
    padding: ${theme.spacing(0.5, 1)};
    background-color: ${theme.colors.background.primary};
  `,
  refId: css`
    color: ${theme.colors.text.link};
    padding: ${theme.spacing(0.5, 1)};
    border: 1px solid ${theme.colors.border.weak};
  `,
});

function ClassicConditionViewer({ model }: { model: ExpressionQuery }) {
  const styles = useStyles2(getClassicConditionViewerStyles);

  const reducerFunctions = keyBy(alertDef.reducerTypes, (rt) => rt.value);
  const evalOperators = keyBy(alertDef.evalOperators, (eo) => eo.value);
  const evalFunctions = keyBy(alertDef.evalFunctions, (ef) => ef.value);

  return (
    <div className={styles.container}>
      {model.conditions?.map(({ query, operator, reducer, evaluator }, index) => {
        const isRange = isRangeEvaluator(evaluator);

        return (
          <React.Fragment key={index}>
            <div className={styles.blue}>
              {index === 0 ? 'WHEN' : !!operator?.type && evalOperators[operator?.type]?.text}
            </div>
            <div className={styles.bold}>{reducer?.type && reducerFunctions[reducer.type]?.text}</div>
            <div className={styles.blue}>OF</div>
            <div className={styles.bold}>{query.params[0]}</div>
            <div className={styles.blue}>{evalFunctions[evaluator.type].text}</div>
            <div className={styles.bold}>
              {isRange ? `(${evaluator.params[0]}; ${evaluator.params[1]})` : evaluator.params[0]}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

const getClassicConditionViewerStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(1)};
    display: grid;
    grid-template-columns: max-content max-content max-content max-content max-content max-content;
    gap: ${theme.spacing(0, 1)};
  `,
  ...getCommonQueryStyles(theme),
});

function ReduceConditionViewer({ model }: { model: ExpressionQuery }) {
  const styles = useStyles2(getReduceConditionViewerStyles);

  const { reducer, expression, settings } = model;
  const reducerType = reducerTypes.find((rt) => rt.value === reducer);
  const modeName = reducerMode.find((rm) => rm.value === settings?.mode);

  return (
    <div className={styles.container}>
      <div className={styles.label}>Function</div>
      <div className={styles.value}>{reducerType?.label}</div>

      <div className={styles.label}>Input</div>
      <div className={styles.value}>{expression}</div>

      <div className={styles.label}>Mode</div>
      <div className={styles.value}>{modeName?.label}</div>
    </div>
  );
}

const getReduceConditionViewerStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(1)};
    display: grid;
    gap: ${theme.spacing(1)};
    grid-template-rows: 1fr 1fr;
    grid-template-columns: 1fr 1fr 1fr 1fr;

    > :nth-child(6) {
      grid-column: span 3;
    }
  `,
  ...getCommonQueryStyles(theme),
});

function ResampleExpressionViewer({ model }: { model: ExpressionQuery }) {
  const styles = useStyles2(getResampleExpressionViewerStyles);

  const { expression, window, downsampler, upsampler } = model;
  const downsamplerType = downsamplingTypes.find((dt) => dt.value === downsampler);
  const upsamplerType = upsamplingTypes.find((ut) => ut.value === upsampler);

  return (
    <div className={styles.container}>
      <div className={styles.label}>Input</div>
      <div className={styles.value}>{expression}</div>

      <div className={styles.label}>Resample to</div>
      <div className={styles.value}>{window}</div>

      <div className={styles.label}>Downsample</div>
      <div className={styles.value}>{downsamplerType?.label}</div>

      <div className={styles.label}>Upsample</div>
      <div className={styles.value}>{upsamplerType?.label}</div>
    </div>
  );
}

const getResampleExpressionViewerStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(1)};
    display: grid;
    gap: ${theme.spacing(1)};
    grid-template-columns: 1fr 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  `,
  ...getCommonQueryStyles(theme),
});

function ThresholdExpressionViewer({ model }: { model: ExpressionQuery }) {
  const styles = useStyles2(getExpressionViewerStyles);

  const { expression, conditions } = model;

  const evaluator = conditions && conditions[0]?.evaluator;
  const thresholdFunction = thresholdFunctions.find((tf) => tf.value === evaluator?.type);

  const isRange = evaluator ? isRangeEvaluator(evaluator) : false;

  return (
    <div className={styles.container}>
      <div className={styles.label}>Input</div>
      <div className={styles.value}>{expression}</div>

      {evaluator && (
        <>
          <div className={styles.blue}>{thresholdFunction?.label}</div>
          <div className={styles.bold}>
            {isRange ? `(${evaluator.params[0]}; ${evaluator.params[1]})` : evaluator.params[0]}
          </div>
        </>
      )}
    </div>
  );
}

function MathExpressionViewer({ model }: { model: ExpressionQuery }) {
  const styles = useStyles2(getExpressionViewerStyles);

  const { expression } = model;

  return (
    <div className={styles.container}>
      <div className={styles.label}>Input</div>
      <div className={styles.value}>{expression}</div>
    </div>
  );
}

const getExpressionViewerStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(1)};
    display: flex;
    gap: ${theme.spacing(1)};
  `,
  ...getCommonQueryStyles(theme),
});

const getCommonQueryStyles = (theme: GrafanaTheme2) => ({
  blue: css`
    color: ${theme.colors.text.link};
  `,
  bold: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
  label: css`
    display: flex;
    align-items: center;
    padding: ${theme.spacing(0.5, 1)};
    background-color: ${theme.colors.background.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    line-height: ${theme.typography.bodySmall.lineHeight};
    font-weight: ${theme.typography.fontWeightBold};
  `,
  value: css`
    padding: ${theme.spacing(0.5, 1)};
    border: 1px solid ${theme.colors.border.weak};
  `,
});

function isRangeEvaluator(evaluator: { params: number[]; type: EvalFunction }) {
  return evaluator.type === EvalFunction.IsWithinRange || evaluator.type === EvalFunction.IsOutsideRange;
}
