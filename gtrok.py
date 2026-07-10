import os
from xai_sdk import Client
from xai_sdk.chat import user

client = Client(api_key="xai-WlGjS20paOdpTMLJAne48SvahDvvmu7tl3jArJbK9uCY289QQslkFRfvliEAl7rpC4lG6KuJkZxnwd9M"), api_host="api.x.ai")

chat = client.chat.create(model="grok-4.5")
chat.append(user("say hey to the world"))

response = chat.sample()

print(response.content)