; Verified People — Windows Installer
; Built with Inno Setup 6 (https://jrsoftware.org/isinfo.php)
;
; To compile:
;   1. Download and install Inno Setup 6 from https://jrsoftware.org/isinfo.php
;   2. Open this file in Inno Setup
;   3. Click Build → Compile  (or press F9)
;   4. Find the installer at dist\VerifiedPeople_Setup.exe

[Setup]
AppId={{D7A3B82F-4C91-4E5A-B203-F8A1C6D94E72}
AppName=Verified People
AppVersion=0.1.0
AppPublisher=Verified People
AppPublisherURL=https://karljuderojas.github.io/Real-Creators/
DefaultDirName={localappdata}\Programs\VerifiedPeople
DisableProgramGroupPage=yes
DisableDirPage=yes
OutputDir=dist
OutputBaseFilename=VerifiedPeople_Setup
Compression=lzma
SolidCompression=yes
; No UAC prompt — installs to user's AppData, no admin rights needed
PrivilegesRequired=lowest
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Core extension files — do NOT include admin.html (contains live credentials)
Source: "background.js";  DestDir: "{app}"; Flags: ignoreversion
Source: "content.js";     DestDir: "{app}"; Flags: ignoreversion
Source: "content.css";    DestDir: "{app}"; Flags: ignoreversion
Source: "manifest.json";  DestDir: "{app}"; Flags: ignoreversion
Source: "popup.html";     DestDir: "{app}"; Flags: ignoreversion
Source: "popup.js";       DestDir: "{app}"; Flags: ignoreversion
Source: "popup.css";      DestDir: "{app}"; Flags: ignoreversion
Source: "icons\*";        DestDir: "{app}\icons"; Flags: ignoreversion recursesubdirs createallsubdirs

[Code]

// ── Find Chrome or Edge executable ───────────────────────────────────────────
function FindBrowser(const RelPath: string): string;
var
  p: string;
begin
  Result := '';
  p := ExpandConstant('{pf64}\') + RelPath;
  if FileExists(p) then begin Result := p; Exit; end;
  p := ExpandConstant('{pf}\') + RelPath;
  if FileExists(p) then begin Result := p; Exit; end;
end;

// ── After files are copied, launch the browser once to register the extension
procedure CurStepChanged(CurStep: TSetupStep);
var
  extDir, browserPath, params: string;
  rc: Integer;
begin
  if CurStep <> ssPostInstall then Exit;

  extDir := ExpandConstant('{app}');

  // Try Chrome first, then Edge
  browserPath := FindBrowser('Google\Chrome\Application\chrome.exe');
  if browserPath = '' then
    browserPath := FindBrowser('Microsoft\Edge\Application\msedge.exe');

  if browserPath = '' then begin
    MsgBox(
      'Verified People files were installed, but Chrome and Edge were not found.' + #13#10 +
      #13#10 +
      'To finish setup manually:' + #13#10 +
      '  1. Open Chrome or Edge' + #13#10 +
      '  2. Go to the Extensions page (chrome://extensions or edge://extensions)' + #13#10 +
      '  3. Enable Developer Mode (toggle, top-right)' + #13#10 +
      '  4. Click "Load unpacked" and select:' + #13#10 +
      '     ' + extDir,
      mbInformation, MB_OK
    );
    Exit;
  end;

  // Launch the browser with --load-extension to register the extension.
  // Chrome will remember it in future sessions as long as Developer Mode is on.
  params := '--load-extension="' + extDir + '"';
  Exec(browserPath, params, '', SW_SHOWNORMAL, ewNoWait, rc);
end;

// ── Custom finish message ─────────────────────────────────────────────────────
function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo,
  MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result :=
    'Verified People will be installed to:' + NewLine +
    Space + ExpandConstant('{app}') + NewLine +
    NewLine +
    'After clicking Install:' + NewLine +
    Space + '1. Chrome or Edge will open automatically.' + NewLine +
    Space + '2. Go to the Extensions page and enable Developer Mode.' + NewLine +
    Space + '3. If Chrome asks to "Disable developer mode extensions" — click Cancel.' + NewLine +
    Space + '4. The Verified People badge will appear on creator profiles on X.';
end;
