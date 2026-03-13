using System;
using System.Diagnostics;
using System.Threading;
using System.IO;
using System.Net.NetworkInformation;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Drawing;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Web.WebView2.Core;

class Launcher : Form {
    [DllImport("shell32.dll", SetLastError = true)]
    static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string AppID);

    private WebView2 webView;
    private Process serverProcess;

    [STAThread]
    static void Main() {
        SetCurrentProcessExplicitAppUserModelID("PyeongHaeng.00Hub.Launcher");
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new Launcher());
    }

    public Launcher() {
        this.Text = "00Hub.";
        this.Size = new Size(1280, 800);
        this.StartPosition = FormStartPosition.CenterScreen;
        this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);

        // 1. Kill existing port 5173 if busy
        KillPort(5173);

        // 2. Start npm run dev hidden
        StartServer();

        // 3. Initialize WebView2
        InitializeWebView();
    }

    private void StartServer() {
        ProcessStartInfo serverInfo = new ProcessStartInfo {
            FileName = "cmd.exe",
            Arguments = "/c npm run dev",
            WindowStyle = ProcessWindowStyle.Hidden,
            CreateNoWindow = true,
            UseShellExecute = false
        };
        serverProcess = Process.Start(serverInfo);
    }

    private async void InitializeWebView() {
        webView = new WebView2();
        webView.Dock = DockStyle.Fill;
        this.Controls.Add(webView);

        try {
            await webView.EnsureCoreWebView2Async(null);
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false; // 깔끔한 UI를 위해 우클릭 메뉴 비활성화
            
            // 전체화면 요청 처리 이벤트 추가
            webView.CoreWebView2.ContainsFullScreenElementChanged += (sender, args) => {
                if (webView.CoreWebView2.ContainsFullScreenElement) {
                    // 전체화면 진입
                    this.FormBorderStyle = FormBorderStyle.None;
                    this.WindowState = FormWindowState.Maximized;
                } else {
                    // 전체화면 탈출
                    this.FormBorderStyle = FormBorderStyle.Sizable;
                    this.WindowState = FormWindowState.Normal;
                }
            };

            // Wait a bit for server to be ready
            Thread.Sleep(2000);
            webView.Source = new Uri("http://localhost:5173");
        } catch (Exception ex) {
            MessageBox.Show("WebView2 초기화 실패: " + ex.Message);
        }
    }

    protected override void OnFormClosing(FormClosingEventArgs e) {
        // Close server process tree when window is closed
        if (serverProcess != null && !serverProcess.HasExited) {
            KillProcessAndChildren(serverProcess.Id);
        }
        base.OnFormClosing(e);
    }

    private void KillProcessAndChildren(int pid) {
        try {
            Process.Start(new ProcessStartInfo {
                FileName = "taskkill.exe",
                Arguments = string.Format("/f /t /pid {0}", pid),
                WindowStyle = ProcessWindowStyle.Hidden,
                CreateNoWindow = true
            }).WaitForExit();
        } catch {}
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
}
