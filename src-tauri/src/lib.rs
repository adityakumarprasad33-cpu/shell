use std::process::Command;

#[tauri::command]
fn execute_local_command(command: String) -> Result<String, String> {
  let output = if cfg!(target_os = "windows") {
    Command::new("powershell")
      .args(["-NoProfile", "-Command", &command])
      .output()
  } else {
    Command::new("sh")
      .args(["-c", &command])
      .output()
  };

  match output {
    Ok(out) => {
      let mut res = String::from_utf8_lossy(&out.stdout).to_string();
      let err = String::from_utf8_lossy(&out.stderr).to_string();
      if !err.is_empty() {
        if !res.is_empty() {
          res.push_str("\n");
        }
        res.push_str(&err);
      }
      Ok(res)
    }
    Err(e) => Err(format!("Failed to execute command: {}", e)),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![execute_local_command])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
