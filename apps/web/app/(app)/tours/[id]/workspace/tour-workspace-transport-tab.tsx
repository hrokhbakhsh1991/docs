"use client";

import { Alert, Card, CardBody, CardHeader, CardTitle, cn, LoadingState } from "@tour/ui";

import { useAppToast } from "@/lib/use-app-toast";

import { DriversManagementTable } from "./DriversManagementTable";
import { TransportActionCenter } from "./TransportActionCenter";
import { TOUR_WORKSPACE_COPY } from "./tour-workspace-copy";
import { useTourTransportOps } from "./use-tour-transport-ops";
import { useTourWorkspaceTransportMetrics } from "./use-tour-workspace-transport-metrics";

import styles from "./tour-workspace-transport.module.css";

const copy = TOUR_WORKSPACE_COPY.transport;

function formatCount(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

function formatPercent(ratio: number): string {
  return new Intl.NumberFormat("fa-IR", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(ratio);
}

export function TourWorkspaceTransportTab() {
  const toast = useAppToast();
  const { metrics, isLoading: metricsLoading } = useTourWorkspaceTransportMetrics();
  const {
    hydrated: opsHydrated,
    readOnly,
    driverRows,
    unassignedPassengers,
    assignPassenger,
    addManualVehicle,
    sendTransportPlan,
    notifyPending,
  } = useTourTransportOps();

  const isLoading = metricsLoading || !opsHydrated;

  if (isLoading) {
    return (
      <Card data-testid="tour-workspace-transport-shell">
        <CardBody>
          <LoadingState message={copy.loading} />
        </CardBody>
      </Card>
    );
  }

  const showDeficit = metrics.carCapacityBalance < 0;
  const gaugePercent =
    metrics.totalCapacity > 0 ? Math.round(metrics.busLoadRatio * 100) : 0;
  const gaugeOverCapacity = metrics.busHeadcount > metrics.totalCapacity && metrics.totalCapacity > 0;

  async function handleSendPlan() {
    try {
      const result = await sendTransportPlan();
      if (result) {
        toast.success({ message: copy.actionCenter.notifySuccess(result.driversNotified) });
      }
    } catch {
      toast.error({ message: copy.actionCenter.notifyError });
    }
  }

  return (
    <div className={styles.stack} data-testid="tour-workspace-transport-dashboard" dir="rtl">
      <TransportActionCenter
        readOnly={readOnly}
        notifyPending={notifyPending}
        onSendPlan={handleSendPlan}
        onAddManualVehicle={addManualVehicle}
      />

      {showDeficit ? (
        <Alert variant="error" title={copy.deficitTitle} role="alert" data-testid="transport-deficit-alert">
          <p style={{ margin: 0 }}>{copy.deficitMessage}</p>
          <p style={{ margin: "0.5rem 0 0", fontSize: "var(--text-small-size)" }}>{copy.deficitMessageFa}</p>
        </Alert>
      ) : null}

      <div className={styles.metricGrid}>
        <article className={styles.metricCard} data-testid="transport-metric-bus">
          <p className={styles.metricLabel}>{copy.metrics.busHeadcount}</p>
          <p className={styles.metricValue}>{formatCount(metrics.busHeadcount)}</p>
          <p className={styles.metricHint}>{copy.metrics.busHeadcountHint}</p>
        </article>
        <article className={styles.metricCard} data-testid="transport-metric-drivers">
          <p className={styles.metricLabel}>{copy.metrics.carDrivers}</p>
          <p className={styles.metricValue}>{formatCount(driverRows.length)}</p>
          <p className={styles.metricHint}>{copy.metrics.carDriversHint}</p>
        </article>
        <article className={styles.metricCard} data-testid="transport-metric-seats">
          <p className={styles.metricLabel}>{copy.metrics.carSeats}</p>
          <p className={styles.metricValue}>{formatCount(metrics.totalCarAvailableSeats)}</p>
          <p className={styles.metricHint}>{copy.metrics.carSeatsHint}</p>
        </article>
        <article className={styles.metricCard} data-testid="transport-metric-passengers">
          <p className={styles.metricLabel}>{copy.metrics.carPassengers}</p>
          <p className={styles.metricValue}>{formatCount(metrics.totalCarPassengers)}</p>
          <p className={styles.metricHint}>{copy.metrics.carPassengersHint}</p>
        </article>
      </div>

      <DriversManagementTable
        drivers={driverRows}
        unassignedPassengers={unassignedPassengers}
        readOnly={readOnly}
        onAssign={assignPassenger}
      />

      <Card>
        <CardHeader>
          <CardTitle>{copy.gauge.title}</CardTitle>
        </CardHeader>
        <CardBody>
          <div className={styles.gaugeSection}>
            <div className={styles.gaugeHeader}>
              <p className={styles.gaugeTitle}>{copy.gauge.caption}</p>
              <p className={styles.gaugeCaption}>
                {formatCount(metrics.busHeadcount)} / {formatCount(metrics.totalCapacity)}{" "}
                {copy.gauge.ofCapacity} ({formatPercent(metrics.busLoadRatio)})
              </p>
            </div>
            <div
              className={styles.gaugeTrack}
              role="meter"
              aria-valuemin={0}
              aria-valuemax={metrics.totalCapacity > 0 ? metrics.totalCapacity : 100}
              aria-valuenow={metrics.busHeadcount}
              aria-label={copy.gauge.title}
            >
              <div
                className={cn(styles.gaugeFill, gaugeOverCapacity && styles.gaugeFillOver)}
                style={{ width: `${Math.min(100, gaugePercent)}%` }}
              />
            </div>
            <ul className={styles.gaugeLegend}>
              <li>
                {copy.gauge.busOnly}: <strong>{formatCount(metrics.busHeadcount)}</strong>
              </li>
              <li>
                {copy.gauge.ofCapacity}: <strong>{formatCount(metrics.totalCapacity)}</strong>
              </li>
              <li>
                {copy.metrics.balance}:{" "}
                <strong
                  className={
                    metrics.carCapacityBalance < 0 ? styles.balanceNegative : styles.balancePositive
                  }
                >
                  {formatCount(metrics.carCapacityBalance)}
                </strong>
              </li>
            </ul>
          </div>
        </CardBody>
      </Card>

      {metrics.selfVehicleWithoutDriverFlag > 0 ? (
        <p className={styles.mutedNote} role="status">
          {copy.metadataGap} ({formatCount(metrics.selfVehicleWithoutDriverFlag)})
        </p>
      ) : null}
    </div>
  );
}
