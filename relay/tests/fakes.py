from app.errors import AuthError, UpstreamError


class FakeTransport:
    def __init__(self, messages, fail_auth=False, fail_upstream=False):
        self.messages = list(messages)
        self.fail_auth = fail_auth
        self.fail_upstream = fail_upstream
        self.published = []
        self.subscribed = []
        self.closed = False

    def open(self):
        if self.fail_auth:
            raise AuthError("bad token")
        if self.fail_upstream:
            raise UpstreamError("broker down")

    def subscribe(self, topic):
        self.subscribed.append(topic)

    def publish(self, topic, payload):
        self.published.append((topic, payload))

    def next_message(self, timeout):
        return self.messages.pop(0) if self.messages else None

    def close(self):
        self.closed = True
