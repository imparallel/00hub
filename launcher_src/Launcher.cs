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
using System.Threading.Tasks;

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

    private NotifyIcon trayIcon;
    private ContextMenu trayMenu;

    public Launcher() {
        this.Text = "00Hub.";
        this.FormBorderStyle = FormBorderStyle.None; // 테두리 제거
        this.WindowState = FormWindowState.Maximized; // 전체화면
        this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        // this.TopMost = true; // Alt+Tab 전환을 위해 상시 TopMost는 제거
        this.ShowInTaskbar = false; // 작업 표시줄에서 숨김

        InitializeTrayIcon();

        // 1. Kill existing port 5173 if busy
        KillPort(5173);

        // 2. Register to Startup (Optional but requested)
        RegisterStartup();

        // 3. Start npm run dev hidden
        StartServer();

        // 4. Initialize WebView2
        InitializeWebView();
    }

    private void InitializeTrayIcon() {
        trayMenu = new ContextMenu();
        trayMenu.MenuItems.Add("00Hub. 열기", (s, e) => {
            this.WindowState = FormWindowState.Minimized; // 강제 갱신용
            this.WindowState = FormWindowState.Maximized;
            this.Show();
            this.Activate();
        });

        // 모니터 이동 서브메뉴 추가
        MenuItem monitorMenu = new MenuItem("모니터 이동");
        for (int i = 0; i < Screen.AllScreens.Length; i++) {
            int index = i;
            monitorMenu.MenuItems.Add(string.Format("모니터 {0} ({1})", i + 1, index == 0 ? "주" : "보조"), (s, e) => {
                MoveToMonitor(index);
            });
        }
        trayMenu.MenuItems.Add(monitorMenu);

        trayMenu.MenuItems.Add("-"); // 구분선
        trayMenu.MenuItems.Add("완전 종료", (s, e) => {
            Application.Exit();
        });

        trayIcon = new NotifyIcon();
        trayIcon.Text = "00Hub.";
        trayIcon.Icon = this.Icon;
        trayIcon.ContextMenu = trayMenu;
        trayIcon.Visible = true;

        trayIcon.DoubleClick += (s, e) => {
            this.WindowState = FormWindowState.Maximized;
            this.Show();
            this.Activate();
        };
    }

    private void MoveToMonitor(int index) {
        if (index >= 0 && index < Screen.AllScreens.Length) {
            Screen targetScreen = Screen.AllScreens[index];
            this.WindowState = FormWindowState.Normal;
            this.StartPosition = FormStartPosition.Manual;
            this.Location = targetScreen.Bounds.Location;
            this.Size = targetScreen.Bounds.Size;
            this.WindowState = FormWindowState.Maximized;
        }
    }

    private void RegisterStartup() {
        try {
            string appName = "00Hub";
            // 경로에 공백이 있으므로 따옴표로 감싸야 윈도우가 정확히 인식함
            string appPath = "\"" + Application.ExecutablePath + "\"";
            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true)) {
                if (key != null) {
                    key.SetValue(appName, appPath);
                }
            }
        } catch {}
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

    private FormWindowState lastWindowState = FormWindowState.Normal;
    private FormBorderStyle lastBorderStyle = FormBorderStyle.Sizable;

    private async void InitializeWebView() {
        webView = new WebView2();
        webView.Dock = DockStyle.Fill;
        this.Controls.Add(webView);

        try {
            await webView.EnsureCoreWebView2Async(null);
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false; 
            
            webView.CoreWebView2.ContainsFullScreenElementChanged += (sender, args) => {
                this.BeginInvoke((MethodInvoker)delegate {
                    // 상시 전체화면 형태 유지하되 Alt+Tab 방해하지 않음
                    this.FormBorderStyle = FormBorderStyle.None;
                    this.WindowState = FormWindowState.Maximized;
                });
            };

            webView.CoreWebView2.WebMessageReceived += (sender, args) => {
                string message = args.TryGetWebMessageAsString();
                if (message == "minimize" || message == "close") {
                    this.BeginInvoke((MethodInvoker)delegate {
                        this.WindowState = FormWindowState.Minimized;
                    });
                } else if (message == "topmost:true") {
                    this.BeginInvoke((MethodInvoker)delegate {
                        this.TopMost = true;
                    });
                } else if (message == "topmost:false") {
                    this.BeginInvoke((MethodInvoker)delegate {
                        this.TopMost = false;
                    });
                }
            };

            await Task.Delay(2000);
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
