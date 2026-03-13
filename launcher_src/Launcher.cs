using System;
using System.Diagnostics;
using System.Threading;
using System.IO;
using System.Net.NetworkInformation;
using System.Linq;
using System.Runtime.InteropServices;

class Launcher {
    [DllImport("shell32.dll", SetLastError = true)]
    static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string AppID);

    static void Main() {
        SetCurrentProcessExplicitAppUserModelID("PyeongHaeng.00Hub.Launcher");
        string appPath = AppDomain.CurrentDomain.BaseDirectory;
        Directory.SetCurrentDirectory(appPath);

        // 1. Kill existing port 5173 if busy
        KillPort(5173);

        // 2. Start npm run dev hidden
        ProcessStartInfo serverInfo = new ProcessStartInfo {
            FileName = "cmd.exe",
            Arguments = "/c npm run dev",
            WindowStyle = ProcessWindowStyle.Hidden,
            CreateNoWindow = true,
            UseShellExecute = false
        };
        Process.Start(serverInfo);

        // 3. Wait for server
        Thread.Sleep(3000);

        // 4. Launch browser in App Mode
        LaunchBrowser("http://localhost:5173");
    }

    static void KillPort(int port) {
        try {
            Process p = new Process();
            p.StartInfo.FileName = "netstat.exe";
            p.StartInfo.Arguments = "-aon";
            p.StartInfo.UseShellExecute = false;
            p.StartInfo.RedirectStandardOutput = true;
            p.StartInfo.CreateNoWindow = true;
            p.Start();
            string output = p.StandardOutput.ReadToEnd();
            p.WaitForExit();

            string[] lines = output.Split(new[] { Environment.NewLine }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var line in lines) {
                if (line.Contains(":" + port) && line.Contains("LISTENING")) {
                    string[] parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    string pid = parts.Last();
                    Process.Start(new ProcessStartInfo {
                        FileName = "taskkill.exe",
                        Arguments = string.Format("/f /pid {0}", pid),
                        WindowStyle = ProcessWindowStyle.Hidden,
                        CreateNoWindow = true
                    }).WaitForExit();
                }
            }
        } catch {}
    }

    static void LaunchBrowser(string url) {
        try {
            // Try Chrome
            Process.Start(new ProcessStartInfo {
                FileName = "chrome.exe",
                Arguments = string.Format("--app=\"{0}\"", url),
                UseShellExecute = true
            });
        } catch {
            try {
                // Try Edge
                Process.Start(new ProcessStartInfo {
                    FileName = "msedge.exe",
                    Arguments = string.Format("--app=\"{0}\"", url),
                    UseShellExecute = true
                });
            } catch {
                // Default browser
                Process.Start(url);
            }
        }
    }
}
