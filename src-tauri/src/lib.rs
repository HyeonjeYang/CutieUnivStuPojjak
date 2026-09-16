use tauri::{Manager, PhysicalPosition, WebviewWindow, WindowEvent};

#[cfg(windows)]
use windows::Win32::Graphics::Gdi::{
    CombineRgn, CreateRectRgn, DeleteObject, SetWindowRgn, ERROR, HGDIOBJ, HRGN, RGN_OR,
};

const EDGE_MARGIN: i32 = 16;

fn primary_bounds(window: &WebviewWindow) -> Result<(i32, i32, i32, i32), String> {
    let monitor = window
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Primary monitor not found.".to_string())?;
    let area = monitor.work_area();
    let right = area.position.x + area.size.width as i32;
    let bottom = area.position.y + area.size.height as i32;

    Ok((area.position.x, area.position.y, right, bottom))
}

fn clamp_position(window: &WebviewWindow, x: i32, y: i32) -> Result<PhysicalPosition<i32>, String> {
    let (left, top, right, bottom) = primary_bounds(window)?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let max_x = (right - size.width as i32).max(left);
    let max_y = (bottom - size.height as i32).max(top);

    Ok(PhysicalPosition::new(
        x.clamp(left, max_x),
        y.clamp(top, max_y),
    ))
}

fn keep_in_bounds(window: &WebviewWindow) -> Result<(), String> {
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let clamped = clamp_position(window, position.x, position.y)?;

    if clamped != position {
        window
            .set_position(clamped)
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn place_bottom_right(window: &WebviewWindow) -> Result<(), String> {
    let (left, top, right, bottom) = primary_bounds(window)?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let x = (right - size.width as i32 - EDGE_MARGIN).max(left);
    let y = (bottom - size.height as i32 - EDGE_MARGIN).max(top);

    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|error| error.to_string())
}

#[cfg(windows)]
fn delete_region(region: HRGN) {
    unsafe {
        let _ = DeleteObject(HGDIOBJ(region.0));
    }
}

#[cfg(windows)]
fn apply_hit_regions(window: &WebviewWindow, rects: Vec<[i32; 4]>) -> Result<(), String> {
    if rects.is_empty() {
        return Ok(());
    }
    if rects.len() > 4096 {
        return Err("Too many hit-test rectangles.".to_string());
    }

    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let region = unsafe { CreateRectRgn(0, 0, 0, 0) };

    if region.0.is_null() {
        return Err("Failed to create the window region.".to_string());
    }

    for [left, top, right, bottom] in rects {
        let left = ((left as f64 * scale).floor() as i32).clamp(0, size.width as i32);
        let top = ((top as f64 * scale).floor() as i32).clamp(0, size.height as i32);
        let right = ((right as f64 * scale).ceil() as i32).clamp(0, size.width as i32);
        let bottom = ((bottom as f64 * scale).ceil() as i32).clamp(0, size.height as i32);

        if left >= right || top >= bottom {
            continue;
        }

        let part = unsafe { CreateRectRgn(left, top, right, bottom) };
        if part.0.is_null() {
            delete_region(region);
            return Err("Failed to create a hit-test region.".to_string());
        }

        let result = unsafe { CombineRgn(Some(region), Some(region), Some(part), RGN_OR) };
        delete_region(part);

        if result.0 == ERROR {
            delete_region(region);
            return Err("Failed to combine hit-test regions.".to_string());
        }
    }

    if unsafe {
        SetWindowRgn(
            window.hwnd().map_err(|error| error.to_string())?,
            Some(region),
            true,
        )
    } == 0
    {
        delete_region(region);
        return Err("Failed to apply the window region.".to_string());
    }

    Ok(())
}

#[tauri::command]
fn set_hit_regions(window: WebviewWindow, rects: Vec<[i32; 4]>) -> Result<(), String> {
    #[cfg(windows)]
    return apply_hit_regions(&window, rects);

    #[cfg(not(windows))]
    {
        let _ = (window, rects);
        Ok(())
    }
}

#[tauri::command]
fn show_pet(window: WebviewWindow) -> Result<(), String> {
    place_bottom_right(&window)?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
fn move_pet(window: WebviewWindow, dx: i32, dy: i32) -> Result<(), String> {
    let position = window.outer_position().map_err(|error| error.to_string())?;
    let next = clamp_position(&window, position.x + dx, position.y + dy)?;

    window.set_position(next).map_err(|error| error.to_string())
}

#[tauri::command]
fn start_dragging(window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|error| error.to_string())?;
    keep_in_bounds(&window)
}

#[tauri::command]
fn close_pet(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .ok_or("Main window not found.")?;
            let moved_window = window.clone();

            window.on_window_event(move |event| {
                if matches!(event, WindowEvent::Moved(_)) {
                    let _ = keep_in_bounds(&moved_window);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_hit_regions,
            show_pet,
            move_pet,
            start_dragging,
            close_pet
        ])
        .run(tauri::generate_context!())
        .expect("Failed to run the Tauri application.");
}
