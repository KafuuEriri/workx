use crate::config::Config;
use std::error::Error;
use workx_config::types::OtelExporterKind as Kind;
use workx_config::types::OtelHttpProtocol as Protocol;
use workx_features::Feature;
use workx_login::default_client::originator;
use workx_otel::OtelExporter;
use workx_otel::OtelHttpProtocol;
use workx_otel::OtelProvider;
use workx_otel::OtelSettings;
use workx_otel::OtelTlsConfig as OtelTlsSettings;

/// Build an OpenTelemetry provider from the app Config.
///
/// Returns `None` when OTEL export is disabled.
pub fn build_provider(
    config: &Config,
    service_version: &str,
    service_name_override: Option<&str>,
    default_analytics_enabled: bool,
) -> Result<Option<OtelProvider>, Box<dyn Error>> {
    let to_otel_exporter = |kind: &Kind| match kind {
        Kind::None => OtelExporter::None,
        Kind::Statsig => OtelExporter::Statsig,
        Kind::OtlpHttp {
            endpoint,
            headers,
            protocol,
            tls,
        } => {
            let protocol = match protocol {
                Protocol::Json => OtelHttpProtocol::Json,
                Protocol::Binary => OtelHttpProtocol::Binary,
            };

            OtelExporter::OtlpHttp {
                endpoint: endpoint.clone(),
                headers: headers
                    .iter()
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect(),
                protocol,
                tls: tls.as_ref().map(|config| OtelTlsSettings {
                    ca_certificate: config.ca_certificate.clone(),
                    client_certificate: config.client_certificate.clone(),
                    client_private_key: config.client_private_key.clone(),
                }),
            }
        }
        Kind::OtlpGrpc {
            endpoint,
            headers,
            tls,
        } => OtelExporter::OtlpGrpc {
            endpoint: endpoint.clone(),
            headers: headers
                .iter()
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect(),
            tls: tls.as_ref().map(|config| OtelTlsSettings {
                ca_certificate: config.ca_certificate.clone(),
                client_certificate: config.client_certificate.clone(),
                client_private_key: config.client_private_key.clone(),
            }),
        },
    };

    let exporter = to_otel_exporter(&config.otel.exporter);
    let trace_exporter = to_otel_exporter(&config.otel.trace_exporter);
    let metrics_exporter = if config
        .analytics_enabled
        .unwrap_or(default_analytics_enabled)
    {
        to_otel_exporter(&config.otel.metrics_exporter)
    } else {
        OtelExporter::None
    };

    let originator = originator();
    let service_name = service_name_override.unwrap_or(originator.value.as_str());
    let runtime_metrics = config.features.enabled(Feature::RuntimeMetrics);

    OtelProvider::try_new(&OtelSettings {
        service_name: service_name.to_string(),
        service_version: service_version.to_string(),
        workx_home: config.workx_home.to_path_buf(),
        environment: config.otel.environment.to_string(),
        exporter,
        trace_exporter,
        metrics_exporter,
        runtime_metrics,
        span_attributes: config.otel.span_attributes.clone(),
        tracestate: config.otel.tracestate.clone(),
    })
}

pub fn record_process_start(otel: Option<&OtelProvider>, originator: &str) {
    let Some(metrics) = otel.and_then(OtelProvider::metrics) else {
        return;
    };
    let _ = workx_otel::record_process_start_once(metrics, originator);
}

pub fn install_sqlite_telemetry(otel: Option<&OtelProvider>, originator: &str) {
    let Some(metrics) = otel.and_then(OtelProvider::metrics) else {
        return;
    };
    let telemetry = workx_rollout::sqlite_telemetry_recorder(metrics.clone(), originator);
    let _ = workx_state::install_process_db_telemetry(telemetry);
}
