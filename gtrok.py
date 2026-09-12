import os
from xai_sdk import Client
from xai_sdk.chat import user

client = Client(api_key=os.environ.get("XAI_API_KEY", ""), api_host="api.x.ai")

chat = client.chat.create(model="grok-4.5")
chat.append(user("say hey to the world"))

response = chat.sample()

print(response.content)