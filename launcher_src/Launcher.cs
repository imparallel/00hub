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
using Microsoft.Win32;

class Launcher : Form {
    [DllImport("shell32.dll", SetLastError = true)]
    static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string AppID);

    private WebView2 webView;
    private Process serverProcess;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct DISPLAY_DEVICE {
        [MarshalAs(UnmanagedType.U4)]
        public int cb;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string DeviceName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string DeviceString;
        [MarshalAs(UnmanagedType.U4)]
        public int StateFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string DeviceID;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string DeviceKey;
    }

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern bool EnumDisplayDevices(string lpDevice, uint iDevNum, ref DISPLAY_DEVICE lpDisplayDevice, uint dwFlags);
    
    [DllImport("user32.dll")]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, int fsModifiers, int vlc);
    
    [DllImport("user32.dll")]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    
    private const int WM_HOTKEY = 0x0312;
    private const int HOTKEY_ID = 1;
    private const int MOD_ALT = 0x0001;
    private const int VK_OEM_3 = 0xC0; // '`' (backtick) key

    [STAThread]
    static void Main() {
        SetCurrentProcessExplicitAppUserModelID("PyeongHaeng.00Hub.Launcher");
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new Launcher());
    }

    private NotifyIcon trayIcon;
    private ContextMenu trayMenu;
    private MenuItem monitorMenu;

    public Launcher() {
        this.Text = "00Hub.";
        this.FormBorderStyle = FormBorderStyle.None; // 테두리 제거
        this.WindowState = FormWindowState.Maximized; // 전체화면
        this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        this.TopMost = true; // 상시 최상단 고정 (Alt+Tab 방지)
        this.ShowInTaskbar = false; // 작업 표시줄에서 숨김

        InitializeTrayIcon();

        // 0. Set Current Working Directory to Application path
        Directory.SetCurrentDirectory(AppDomain.CurrentDomain.BaseDirectory);

        // 1. Kill existing port 23500 if busy
        KillPort(23500);

        // 2. Register to Startup (Optional but requested)
        RegisterStartup();

        // 3. Start npm run dev hidden
        StartServer();

        // 4. Initialize WebView2
        InitializeWebView();

        // 5. Register Global HotKey (Alt + `)
        this.HandleCreated += (s, e) => {
            RegisterHotKey(this.Handle, HOTKEY_ID, MOD_ALT, VK_OEM_3);
        };
    }

    private void InitializeTrayIcon() {
        trayMenu = new ContextMenu();
        trayMenu.MenuItems.Add("00Hub. 열기", (s, e) => {
            if (!this.Visible) {
                this.Show();
                webView.Show(); // WebView2도 다시 표시
                webView.CoreWebView2.PostWebMessageAsString("visibility:visible");
            }
            this.WindowState = FormWindowState.Normal; // 상태 강제 초기화
            this.WindowState = FormWindowState.Maximized;
            this.Activate();
        });

        // 모니터 이동 서브메뉴 추가 (동적으로 생성될 예정)
        monitorMenu = new MenuItem("모니터 이동");
        UpdateMonitorMenu();
        trayMenu.MenuItems.Add(monitorMenu);

        // 디스플레이 설정 변경 감지 이벤트 등록
        SystemEvents.DisplaySettingsChanged += (s, e) => {
            this.BeginInvoke((MethodInvoker)delegate {
                UpdateMonitorMenu();
            });
        };

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
            if (!this.Visible) {
                this.Show();
                webView.Show(); // WebView2도 다시 표시
                webView.CoreWebView2.PostWebMessageAsString("visibility:visible");
            }
            this.WindowState = FormWindowState.Maximized;
            this.Activate();
        };
    }

    private void UpdateMonitorMenu() {
        if (monitorMenu == null) return;
        
        monitorMenu.MenuItems.Clear();
        for (int i = 0; i < Screen.AllScreens.Length; i++) {
            int index = i;
            Screen screen = Screen.AllScreens[i];
            
            string friendlyName = GetMonitorFriendlyName(screen.DeviceName);
            string label = string.Format("모니터 {0}: {1} ({2})", i + 1, friendlyName, screen.Primary ? "주" : "보조");
            
            monitorMenu.MenuItems.Add(label, (s, e) => {
                MoveToMonitor(index);
            });
        }
    }

    private string GetMonitorFriendlyName(string deviceName) {
        DISPLAY_DEVICE device = new DISPLAY_DEVICE();
        device.cb = Marshal.SizeOf(device);
        
        // 1. Get the device info
        if (EnumDisplayDevices(deviceName, 0, ref device, 0)) {
            // 2. Get the monitor info (second call with device.DeviceName)
            DISPLAY_DEVICE monitor = new DISPLAY_DEVICE();
            monitor.cb = Marshal.SizeOf(monitor);
            if (EnumDisplayDevices(device.DeviceName, 0, ref monitor, 0)) {
                return monitor.DeviceString;
            }
            return device.DeviceString;
        }
        return "알 수 없는 모니터";
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
            WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory,
            WindowStyle = ProcessWindowStyle.Hidden,
            CreateNoWindow = true,
            UseShellExecute = false
        };
        serverProcess = Process.Start(serverInfo);
    }

    private bool isZenModeActive = false;

    private async void InitializeWebView() {
        webView = new WebView2();
        webView.Dock = DockStyle.Fill;
        this.Controls.Add(webView);

        try {
            await webView.EnsureCoreWebView2Async(null);
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false; 
            
            webView.CoreWebView2.ContainsFullScreenElementChanged += (sender, args) => {
                this.BeginInvoke((MethodInvoker)delegate {
                    if (!this.Visible) return;
                    this.FormBorderStyle = FormBorderStyle.None;
                    this.WindowState = FormWindowState.Maximized;
                });
            };

            webView.CoreWebView2.WebMessageReceived += (sender, args) => {
                string message = args.TryGetWebMessageAsString();
                if (message == "minimize" || message == "close") {
                    this.BeginInvoke((MethodInvoker)delegate {
                        webView.CoreWebView2.PostWebMessageAsString("visibility:hidden");
                        webView.Hide();
                        this.Hide();
                    });
                } else if (message == "topmost:true" || message == "topmost:false") {
                    this.BeginInvoke((MethodInvoker)delegate {
                        this.TopMost = true; 
                    });
                } else if (message == "zen:on") {
                    isZenModeActive = true;
                } else if (message == "zen:off") {
                    isZenModeActive = false;
                }
            };

            // 고정 딜레이(5000ms) 대신 실제로 포트가 LISTEN 상태가 될 때까지 폴링합니다.
            // 이렇게 해야 Navigate가 정확히 1번만 실행되어 React 앱이 두 번 마운트 되는 현상을 막을 수 있습니다.
            await WaitForPortAsync(23500, timeoutMs: 30000);
            webView.Source = new Uri("http://localhost:23500");
        } catch (Exception ex) {
            MessageBox.Show("WebView2 초기화 실패: " + ex.Message);
        }
    }

    private async Task WaitForPortAsync(int port, int timeoutMs = 30000) {
        var url = string.Format("http://localhost:{0}/", port);
        var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
        using (var client = new System.Net.Http.HttpClient()) {
            client.Timeout = TimeSpan.FromMilliseconds(800);
            while (DateTime.UtcNow < deadline) {
                try {
                    var response = await client.GetAsync(url);
                    if (response.IsSuccessStatusCode) {
                        // Vite가 HTML을 완전히 응답할 수 있는 시점임을 확인.
                        // 초기 번들링이 완료되도록 아주 짧게 여유를 줍니다.
                        await Task.Delay(200);
                        return;
                    }
                } catch { }
                await Task.Delay(300);
            }
        }
    }

    protected override void WndProc(ref Message m) {
        if (m.Msg == WM_HOTKEY && m.WParam.ToInt32() == HOTKEY_ID) {
            if (!isZenModeActive) { // Zen 모드가 아닐 때만 토글 허용
                ToggleWindow();
            }
        }
        base.WndProc(ref m);
    }

    private void ToggleWindow() {
        if (this.Visible) {
            this.BeginInvoke((MethodInvoker)delegate {
                webView.CoreWebView2.PostWebMessageAsString("visibility:hidden");
                webView.Hide();
                this.Hide();
            });
        } else {
            this.BeginInvoke((MethodInvoker)delegate {
                this.Show();
                webView.Show();
                webView.CoreWebView2.PostWebMessageAsString("visibility:visible");
                this.WindowState = FormWindowState.Normal;
                this.WindowState = FormWindowState.Maximized;
                this.Activate();
                this.TopMost = true;
            });
        }
    }

    protected override void OnFormClosing(FormClosingEventArgs e) {
        UnregisterHotKey(this.Handle, HOTKEY_ID);

        // 시스템 종료 시에는 윈도우가 프로세스들을 알아서 정리하므로, 
        // 중복해서 종료를 시도하다가 taskkill.exe 오류가 발생하는 것을 방지합니다.
        if (e.CloseReason == CloseReason.WindowsShutDown) {
            return;
        }

        // Close server process tree when window is closed
        if (serverProcess != null && !serverProcess.HasExited) {
            KillProcessAndChildren(serverProcess.Id);
        }
        base.OnFormClosing(e);
    }

    private void KillProcessAndChildren(int pid) {
        try {
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "taskkill.exe";
            psi.Arguments = string.Format("/f /t /pid {0}", pid);
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            psi.CreateNoWindow = true;
            Process.Start(psi).WaitForExit();
        } catch (Exception ex) {
            Debug.WriteLine("Process cleanup error: " + ex.Message);
        }
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
            foreach (string line in lines) {
                if (line.Contains(":" + port) && line.Contains("LISTENING")) {
                    string[] parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    string pidStr = parts[parts.Length - 1];
                    int pid;
                    if (int.TryParse(pidStr, out pid)) {
                        try {
                            ProcessStartInfo psi = new ProcessStartInfo();
                            psi.FileName = "taskkill.exe";
                            psi.Arguments = string.Format("/f /pid {0}", pid);
                            psi.WindowStyle = ProcessWindowStyle.Hidden;
                            psi.CreateNoWindow = true;
                            Process.Start(psi).WaitForExit();
                        } catch { }
                    }
                }
            }
        } catch (Exception ex) {
            Debug.WriteLine("KillPort error: " + ex.Message);
        }
    }
}
