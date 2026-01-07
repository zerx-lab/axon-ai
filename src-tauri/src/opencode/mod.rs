//! OpenCode binary management and service control

mod downloader;
mod platform;
mod service;
mod types;

// TODO: OpencodeDownloader will be used for manual download triggers from frontend
#[allow(unused_imports)]
pub use downloader::OpencodeDownloader;
pub use service::OpencodeService;
pub use types::*;
