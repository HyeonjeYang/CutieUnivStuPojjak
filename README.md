# CutieUnivStuPojjak

A minimal transparent Windows desktop GF built with Tauri 2. Transparent pixels are click-through; drag the visible character to move it.

## Requirements

- Windows 10 or 11 with WebView2
- Node.js `20.19+` or `22.12+`
- Rust `1.77.2+` with the MSVC toolchain
- Visual Studio Build Tools with **Desktop development with C++**

## Download

With Git:

```cmd
git clone https://github.com/HyeonjeYang/CutieUnivStuPojjak.git
cd CutieUnivStuPojjak
```

Without Git, [download the ZIP](https://github.com/HyeonjeYang/CutieUnivStuPojjak/archive/refs/heads/main.zip), extract it, and open the extracted folder.

## Run

Open Command Prompt in the repository root:

```cmd
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
npm install
npm run tauri dev
```

The `set` line is only needed when `cargo` is not already available in CMD.

## Build

```cmd
npm run tauri build
```

Run the portable executable at:

```text
src-tauri\target\release\cutie-univ-stu-pojjak.exe
```

`dist/` and `src-tauri/target/` are generated automatically and are not committed.

## Controls

- Drag character: move
- Arrow keys: move
- `1` / `2`: switch mood
- `Esc` or right-click: close

Frames are stored in `src/assets/mood1/` and `src/assets/mood2/` as `mathgaki-mood1-01.png`, `mathgaki-mood2-01.png`, and so on.

## Credit

Image credit: Hyeonje Yang. The animation frames were enhanced from the original photograph.

## License

MIT License

Copyright (c) 2026 Present_0206

<img width="1369" height="1802" alt="수학이" src="https://github.com/user-attachments/assets/9a83381f-7de5-4f30-8acc-14935ccb8126" />

