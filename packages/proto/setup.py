from setuptools import setup, find_packages
setup(
    name="shared-proto",
    version="0.1.0",
    packages=["shared_proto"],
    package_dir={"shared_proto": "generated/python"},
)