Option Explicit
Dim shell, files, root, script, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
script = files.BuildPath(root, "scripts\start-local-hidden.ps1")
command = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & script & Chr(34)
shell.Run command, 0, False
