from pathlib import Path

root = Path('.')
path = root / '.github/workflows/store-validation.yml'
text = path.read_text()
old = '''          xcodebuild \\
            -workspace "$WORKSPACE" \\
            -scheme "$SCHEME" \\
            -configuration Debug \\
            -destination 'generic/platform=iOS Simulator' \\
            CODE_SIGNING_ALLOWED=NO \\
            build\n'''
new = '''          set +e\n          xcodebuild \\
            -workspace "$WORKSPACE" \\
            -scheme "$SCHEME" \\
            -configuration Debug \\
            -destination 'generic/platform=iOS Simulator' \\
            CODE_SIGNING_ALLOWED=NO \\
            build 2>&1 | tee /tmp/hassoun-xcode.log\n          STATUS=${PIPESTATUS[0]}\n          if [ "$STATUS" -ne 0 ]; then\n            echo "========== HASSOUN XCODE COMPILER ERRORS =========="\n            grep -nE '(^|[[:space:]])(error:|fatal error:)|SwiftCompile|CompileSwift' /tmp/hassoun-xcode.log | tail -n 160 || true\n            echo "===================================================="\n            exit "$STATUS"\n          fi\n'''
if text.count(old) != 1:
    raise SystemExit('Xcode build block changed; refusing unsafe patch')
path.write_text(text.replace(old, new, 1))
(root / '.github/workflows/one-time-xcode-error-summary.yml').unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
